import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customersTable, quoteRequestsTable, jobsTable } from "@workspace/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  signCustomerToken,
  setCustomerAuthCookie,
  clearCustomerAuthCookie,
  requireCustomer,
  isValidUsername,
  normalizeUsername,
  suggestUsernameFromName,
  generateRandomPassword,
  signEmailVerificationToken,
  verifyEmailVerificationToken,
  signPasswordResetToken,
  verifyPasswordResetToken,
  passwordResetHashKey,
} from "../lib/auth";
import {
  sendAccountCredentialsEmail,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from "../lib/email-service";

const router: IRouter = Router();

function getAppBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  const domain =
    process.env.REPLIT_DEPLOYMENT === "1"
      ? process.env.REPLIT_DOMAINS?.split(",")[0]
      : process.env.REPLIT_DEV_DOMAIN;
  return domain ? `https://${domain}` : "https://teemermoving.com";
}

async function ensureUniqueUsername(base: string): Promise<string> {
  const baseCore = base.startsWith("+") ? base.slice(1) : base;
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = attempt === 0 ? `+${baseCore}` : `+${baseCore}${Math.floor(100 + Math.random() * 900)}`;
    const [existing] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.username, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  return `+${baseCore}${Date.now().toString(36)}`;
}

/**
 * Securely attach a single quote (and any job already created from it) to the
 * given customer. The quote's email must match the customer's email — this is
 * the only ownership signal we accept at signup time, since the customer has
 * not yet verified their email.
 *
 * Returns true if the quote was attached, false otherwise.
 */
async function attachQuoteToCustomer(opts: {
  quoteId: number;
  customerId: number;
  customerEmail: string;
}): Promise<boolean> {
  const { quoteId, customerId, customerEmail } = opts;
  const lowered = customerEmail.toLowerCase();

  const [quote] = await db
    .select({ id: quoteRequestsTable.id, email: quoteRequestsTable.email, customerId: quoteRequestsTable.customerId })
    .from(quoteRequestsTable)
    .where(eq(quoteRequestsTable.id, quoteId))
    .limit(1);
  if (!quote) return false;
  if ((quote.email ?? "").toLowerCase() !== lowered) return false;
  if (quote.customerId && quote.customerId !== customerId) return false;

  await db
    .update(quoteRequestsTable)
    .set({ customerId })
    .where(and(eq(quoteRequestsTable.id, quoteId), isNull(quoteRequestsTable.customerId)));

  // If a job has already been created from this quote, link it too.
  await db
    .update(jobsTable)
    .set({ customerId })
    .where(and(eq(jobsTable.quoteId, quoteId), isNull(jobsTable.customerId)));

  return true;
}

router.post("/customer-auth/signup", async (req, res) => {
  try {
    const fullName = String(req.body?.fullName ?? "").trim();
    const emailRaw = String(req.body?.email ?? "").trim();
    const phoneRaw = req.body?.phone != null ? String(req.body.phone).trim() : "";
    const requestedUsername = req.body?.username ? String(req.body.username).trim() : "";
    const attachQuoteId = req.body?.attachQuoteId != null ? Number(req.body.attachQuoteId) : null;

    if (!fullName || !emailRaw) {
      res.status(400).json({ error: "Full name and email are required." });
      return;
    }
    const email = emailRaw.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Please provide a valid email address." });
      return;
    }
    const phone = phoneRaw || null;

    let username: string;
    if (requestedUsername) {
      const normalized = normalizeUsername(requestedUsername);
      if (!isValidUsername(normalized)) {
        res.status(400).json({
          error:
            "Username must start with + and contain 3-30 letters, numbers, or underscores (e.g. +alanteemer).",
        });
        return;
      }
      const [taken] = await db
        .select({ id: customersTable.id })
        .from(customersTable)
        .where(eq(customersTable.username, normalized))
        .limit(1);
      if (taken) {
        res.status(409).json({ error: "That username is already taken." });
        return;
      }
      username = normalized;
    } else {
      username = await ensureUniqueUsername(suggestUsernameFromName(fullName));
    }

    // Always generate a temporary password — customers receive it by email.
    const generatedPassword = generateRandomPassword(12);
    const passwordHash = await hashPassword(generatedPassword);

    // Reuse an existing un-claimed contact record by email; otherwise insert.
    const [existing] = await db
      .select()
      .from(customersTable)
      .where(sql`lower(${customersTable.email}) = ${email}`)
      .limit(1);

    let customerId: number;
    if (existing) {
      if (existing.passwordHash) {
        res.status(409).json({
          error: "An account with this email already exists. Please sign in instead.",
        });
        return;
      }
      const [updated] = await db
        .update(customersTable)
        .set({
          fullName,
          phone: phone ?? existing.phone,
          username,
          passwordHash,
        })
        .where(eq(customersTable.id, existing.id))
        .returning();
      customerId = updated.id;
    } else {
      const [created] = await db
        .insert(customersTable)
        .values({
          fullName,
          email,
          phone,
          username,
          passwordHash,
        })
        .returning();
      customerId = created.id;
    }

    // Securely attach the in-flight quote (and any job already created from it)
    // ONLY if the quote's email matches the signup email. We never bulk-attach
    // historical records by email — that would let anyone claim someone else's
    // jobs by registering with their email.
    let attachedQuoteId: number | null = null;
    if (attachQuoteId && Number.isFinite(attachQuoteId)) {
      const ok = await attachQuoteToCustomer({
        quoteId: attachQuoteId,
        customerId,
        customerEmail: email,
      });
      if (ok) attachedQuoteId = attachQuoteId;
    }

    const baseUrl = getAppBaseUrl();
    const loginUrl = `${baseUrl}/account/login`;
    sendAccountCredentialsEmail({
      customerName: fullName,
      username,
      email,
      temporaryPassword: generatedPassword,
      loginUrl,
    }).catch((err) => req.log.error({ err }, "Failed to send account credentials email"));

    // Fire off a verification email so the customer can confirm ownership of
    // the address. This is a separate email so the credentials email stays
    // focused on sign-in details.
    const verificationToken = signEmailVerificationToken(customerId, email);
    const verificationUrl = `${baseUrl}/account/verify-email?token=${encodeURIComponent(verificationToken)}`;
    sendEmailVerificationEmail({
      customerName: fullName,
      email,
      verificationUrl,
    }).catch((err) => req.log.error({ err }, "Failed to send email verification email"));

    const payload = { customerId, email, username, fullName };
    const token = signCustomerToken(payload);
    setCustomerAuthCookie(res, token);

    res.status(201).json({
      customer: payload,
      generatedPassword,
      attachedQuoteId,
    });
  } catch (err) {
    req.log.error({ err }, "Customer signup failed");
    res.status(500).json({ error: "Could not create account." });
  }
});

router.post("/customer-auth/login", async (req, res) => {
  try {
    const identifierRaw = String(req.body?.identifier ?? req.body?.email ?? req.body?.username ?? "").trim();
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!identifierRaw || !password) {
      res.status(400).json({ error: "Username/email and password are required." });
      return;
    }

    const isUsernameLookup = identifierRaw.startsWith("+");
    const lookup = isUsernameLookup ? normalizeUsername(identifierRaw) : identifierRaw.toLowerCase();

    const [customer] = isUsernameLookup
      ? await db.select().from(customersTable).where(eq(customersTable.username, lookup)).limit(1)
      : await db
          .select()
          .from(customersTable)
          .where(sql`lower(${customersTable.email}) = ${lookup}`)
          .limit(1);

    if (!customer || !customer.passwordHash) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const ok = await verifyPassword(password, customer.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const payload = {
      customerId: customer.id,
      email: customer.email,
      username: customer.username ?? `+customer${customer.id}`,
      fullName: customer.fullName,
    };
    const token = signCustomerToken(payload);
    setCustomerAuthCookie(res, token);

    res.json({ customer: payload });
  } catch (err) {
    req.log.error({ err }, "Customer login failed");
    res.status(500).json({ error: "Login failed." });
  }
});

router.post("/customer-auth/logout", (_req, res) => {
  clearCustomerAuthCookie(res);
  res.json({ success: true });
});

router.get("/customer-auth/me", requireCustomer, async (req, res) => {
  const [c] = await db
    .select({
      id: customersTable.id,
      fullName: customersTable.fullName,
      email: customersTable.email,
      phone: customersTable.phone,
      username: customersTable.username,
      emailVerifiedAt: customersTable.emailVerifiedAt,
    })
    .from(customersTable)
    .where(eq(customersTable.id, req.customer!.customerId))
    .limit(1);
  if (!c) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.json({
    customer: {
      customerId: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      username: c.username ?? `+customer${c.id}`,
      emailVerified: c.emailVerifiedAt != null,
      emailVerifiedAt: c.emailVerifiedAt,
    },
  });
});

// ─── Email verification ─────────────────────────────────────────────────────

/**
 * Confirm the JWT in the link is valid AND still matches the customer's
 * current email address, then stamp `emailVerifiedAt`. Idempotent: re-verifying
 * an already-verified account succeeds silently.
 */
router.post("/customer-auth/verify-email", async (req, res) => {
  try {
    const tokenRaw = req.body?.token;
    const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";
    if (!token) {
      res.status(400).json({ error: "Missing verification token." });
      return;
    }

    const decoded = verifyEmailVerificationToken(token);
    if (!decoded) {
      res.status(400).json({ error: "This verification link is invalid or has expired." });
      return;
    }

    const [customer] = await db
      .select({
        id: customersTable.id,
        email: customersTable.email,
        emailVerifiedAt: customersTable.emailVerifiedAt,
      })
      .from(customersTable)
      .where(eq(customersTable.id, decoded.customerId))
      .limit(1);

    if (!customer) {
      res.status(400).json({ error: "This verification link is invalid or has expired." });
      return;
    }

    // The email on the token must still match the one on the account — this
    // prevents an old token from verifying a new email after the customer
    // changed their address.
    if ((customer.email ?? "").toLowerCase() !== decoded.email.toLowerCase()) {
      res.status(400).json({ error: "This verification link is no longer valid for this account." });
      return;
    }

    if (!customer.emailVerifiedAt) {
      await db
        .update(customersTable)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(customersTable.id, customer.id));
    }

    res.json({ success: true, alreadyVerified: customer.emailVerifiedAt != null });
  } catch (err) {
    req.log.error({ err }, "Email verification failed");
    res.status(500).json({ error: "Verification failed." });
  }
});

/**
 * Re-send a verification email to the currently signed-in customer. Useful
 * for accounts whose first email expired or got lost.
 */
router.post("/customer-auth/resend-verification", requireCustomer, async (req, res) => {
  try {
    const [customer] = await db
      .select({
        id: customersTable.id,
        email: customersTable.email,
        fullName: customersTable.fullName,
        emailVerifiedAt: customersTable.emailVerifiedAt,
      })
      .from(customersTable)
      .where(eq(customersTable.id, req.customer!.customerId))
      .limit(1);

    if (!customer) {
      res.status(404).json({ error: "Account not found." });
      return;
    }

    if (customer.emailVerifiedAt) {
      res.json({ success: true, alreadyVerified: true });
      return;
    }

    const baseUrl = getAppBaseUrl();
    const verificationToken = signEmailVerificationToken(customer.id, customer.email);
    const verificationUrl = `${baseUrl}/account/verify-email?token=${encodeURIComponent(verificationToken)}`;
    sendEmailVerificationEmail({
      customerName: customer.fullName,
      email: customer.email,
      verificationUrl,
    }).catch((err) => req.log.error({ err }, "Failed to resend email verification email"));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Resend verification failed");
    res.status(500).json({ error: "Could not resend verification email." });
  }
});

// ─── Password reset ─────────────────────────────────────────────────────────

/**
 * Always responds 200 with the same body, regardless of whether the email
 * exists, so attackers can't enumerate registered addresses.
 */
router.post("/customer-auth/forgot-password", async (req, res) => {
  try {
    const emailRaw = String(req.body?.email ?? "").trim();
    const email = emailRaw.toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      // Still respond 200 to avoid leaking information about which addresses
      // are valid, but log a hint for ourselves.
      req.log.info({ email: emailRaw }, "Forgot-password: invalid email shape, ignoring");
      res.json({ success: true });
      return;
    }

    const [customer] = await db
      .select({
        id: customersTable.id,
        email: customersTable.email,
        fullName: customersTable.fullName,
        passwordHash: customersTable.passwordHash,
      })
      .from(customersTable)
      .where(sql`lower(${customersTable.email}) = ${email}`)
      .limit(1);

    if (customer && customer.passwordHash) {
      const baseUrl = getAppBaseUrl();
      const token = signPasswordResetToken(customer.id, customer.passwordHash);
      const resetUrl = `${baseUrl}/account/reset-password?token=${encodeURIComponent(token)}`;
      sendPasswordResetEmail({
        email: customer.email,
        customerName: customer.fullName,
        resetUrl,
      }).catch((err) => req.log.error({ err }, "Failed to send password reset email"));
    } else {
      req.log.info({ email }, "Forgot-password: no matching account with a password");
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Forgot-password handler failed");
    // Even on internal errors return success to avoid info leakage.
    res.json({ success: true });
  }
});

/**
 * Validate a reset token without consuming it — used by the reset page so we
 * can show "this link is expired" before the user types a new password.
 */
router.get("/customer-auth/reset-password/check", async (req, res) => {
  const tokenRaw = typeof req.query.token === "string" ? req.query.token : "";
  if (!tokenRaw) {
    res.status(400).json({ valid: false, error: "Missing token." });
    return;
  }
  const decoded = verifyPasswordResetToken(tokenRaw);
  if (!decoded) {
    res.json({ valid: false, error: "This reset link is invalid or has expired." });
    return;
  }
  const [customer] = await db
    .select({ id: customersTable.id, passwordHash: customersTable.passwordHash, email: customersTable.email })
    .from(customersTable)
    .where(eq(customersTable.id, decoded.customerId))
    .limit(1);
  if (!customer || !customer.passwordHash) {
    res.json({ valid: false, error: "This reset link is invalid or has expired." });
    return;
  }
  if (passwordResetHashKey(customer.passwordHash) !== decoded.hashKey) {
    res.json({ valid: false, error: "This reset link has already been used." });
    return;
  }
  res.json({ valid: true, email: customer.email });
});

router.post("/customer-auth/reset-password", async (req, res) => {
  try {
    const tokenRaw = req.body?.token;
    const passwordRaw = req.body?.password;
    const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";
    const password = typeof passwordRaw === "string" ? passwordRaw : "";

    if (!token) {
      res.status(400).json({ error: "Missing reset token." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
      return;
    }

    const decoded = verifyPasswordResetToken(token);
    if (!decoded) {
      res.status(400).json({ error: "This reset link is invalid or has expired." });
      return;
    }

    const [customer] = await db
      .select({
        id: customersTable.id,
        email: customersTable.email,
        username: customersTable.username,
        fullName: customersTable.fullName,
        passwordHash: customersTable.passwordHash,
      })
      .from(customersTable)
      .where(eq(customersTable.id, decoded.customerId))
      .limit(1);

    if (!customer || !customer.passwordHash) {
      res.status(400).json({ error: "This reset link is invalid or has expired." });
      return;
    }

    // Single-use guard: if the password hash on the account no longer matches
    // the hashKey embedded in the token, the token has been spent (or the
    // password was changed by some other path).
    if (passwordResetHashKey(customer.passwordHash) !== decoded.hashKey) {
      res.status(400).json({ error: "This reset link has already been used." });
      return;
    }

    const newHash = await hashPassword(password);
    await db
      .update(customersTable)
      .set({ passwordHash: newHash })
      .where(eq(customersTable.id, customer.id));

    // Log the customer in so they don't have to re-enter their fresh password.
    const payload = {
      customerId: customer.id,
      email: customer.email,
      username: customer.username ?? `+customer${customer.id}`,
      fullName: customer.fullName,
    };
    const sessionToken = signCustomerToken(payload);
    setCustomerAuthCookie(res, sessionToken);

    res.json({ success: true, customer: payload });
  } catch (err) {
    req.log.error({ err }, "Password reset failed");
    res.status(500).json({ error: "Could not reset password." });
  }
});

router.get("/customer-auth/check-username", async (req, res) => {
  const username = typeof req.query.username === "string" ? req.query.username : "";
  if (!username) {
    res.status(400).json({ error: "username required" });
    return;
  }
  const normalized = normalizeUsername(username);
  if (!isValidUsername(normalized)) {
    res.json({ available: false, normalized, valid: false });
    return;
  }
  const [taken] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(eq(customersTable.username, normalized))
    .limit(1);
  res.json({ available: !taken, normalized, valid: true });
});

export default router;

export { attachQuoteToCustomer };
