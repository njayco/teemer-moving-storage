import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { customersTable, quoteRequestsTable, jobsTable, emailLogsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  startTestServer,
  stopTestServer,
  api,
  CookieJar,
  testEmail,
  testUsername,
  uniqueSuffix,
  makeQuote,
  makeJobForQuote,
  track,
} from "./test-helpers.js";
import { __resetIpHitsForTests } from "../lib/auth-rate-limit";
import {
  signCustomerToken,
  signEmailVerificationToken,
  signPasswordResetToken,
} from "../lib/auth";

// Mirrors the secret resolution in src/lib/auth.ts. Used for synthesizing
// expired or wrong-purpose tokens that the public helpers won't produce.
const TEST_JWT_SECRET = process.env.JWT_SECRET || "teemer-dev-secret-local-only";

function signExpiredVerificationToken(customerId: number, email: string): string {
  return jwt.sign(
    {
      purpose: "customer_email_verification",
      customerId,
      email: email.toLowerCase(),
    },
    TEST_JWT_SECRET,
    { expiresIn: "-1s" },
  );
}

function signExpiredResetToken(customerId: number, hashKey: string): string {
  return jwt.sign(
    { purpose: "customer_password_reset", customerId, hashKey },
    TEST_JWT_SECRET,
    { expiresIn: "-1s" },
  );
}

before(async () => {
  await startTestServer();
});
after(async () => {
  await stopTestServer();
});

describe("POST /api/customer-auth/signup", () => {
  test("creates a new customer and returns a session cookie + generated password", async () => {
    const email = testEmail("signup");
    const jar = new CookieJar();
    const res = await api("/api/customer-auth/signup", {
      method: "POST",
      cookieJar: jar,
      body: { fullName: "Jane Tester", email },
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.customer);
    assert.equal(res.body.customer.email, email);
    assert.match(res.body.customer.username, /^\+/, "username should be + prefixed");
    assert.equal(typeof res.body.generatedPassword, "string");
    assert.equal(res.body.generatedPassword.length, 12);
    assert.equal(res.body.attachedQuoteId, null);
    track.customer(res.body.customer.customerId);

    // Cookie should be set so /me works for the same jar.
    const me = await api("/api/customer-auth/me", { cookieJar: jar });
    assert.equal(me.status, 200);
    assert.equal(me.body.customer.email, email);
  });

  test("rejects missing fields with 400", async () => {
    const res = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "" },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /full name and email/i);
  });

  test("rejects invalid email format with 400", async () => {
    const res = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Bad Email", email: "not-an-email" },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /valid email/i);
  });

  test("normalizes email to lowercase on storage", async () => {
    const upper = `Mixed.${uniqueSuffix()}@TEEMER-Tests.LOCAL`;
    const res = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Mixed Case", email: upper },
    });
    assert.equal(res.status, 201);
    track.customer(res.body.customer.customerId);
    assert.equal(res.body.customer.email, upper.toLowerCase());
  });

  test("explicit username must start with + and match the validation regex", async () => {
    const email = testEmail("badname");
    const res = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Bad Username", email, username: "no-plus-and-bad-chars!" },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /username/i);
  });

  test("returns 409 when explicitly chosen username is already taken", async () => {
    const sharedUsername = testUsername("dup");

    const first = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "First Owner", email: testEmail("first"), username: sharedUsername },
    });
    assert.equal(first.status, 201);
    track.customer(first.body.customer.customerId);
    assert.equal(first.body.customer.username, sharedUsername);

    const second = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Second Owner", email: testEmail("second"), username: sharedUsername },
    });
    assert.equal(second.status, 409);
    assert.match(second.body.error, /already taken/i);
  });

  test("returns 409 when email already has a password (existing account)", async () => {
    const email = testEmail("dupe");
    const first = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Original", email },
    });
    assert.equal(first.status, 201);
    track.customer(first.body.customer.customerId);

    const second = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Imposter", email },
    });
    assert.equal(second.status, 409);
    assert.match(second.body.error, /already exists/i);
  });

  test("auto-generated usernames stay unique across same-name signups", async () => {
    // Both signups use the same full name → identical base username candidate.
    // The uniqueness loop should append a suffix to avoid the unique-index collision.
    const sharedName = `Sameface ${uniqueSuffix()}`;
    const a = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: sharedName, email: testEmail("samea") },
    });
    assert.equal(a.status, 201);
    track.customer(a.body.customer.customerId);

    const b = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: sharedName, email: testEmail("sameb") },
    });
    assert.equal(b.status, 201);
    track.customer(b.body.customer.customerId);

    assert.notEqual(
      a.body.customer.username,
      b.body.customer.username,
      "Two same-name signups should not collide on username",
    );
  });

  test("attachQuoteId attaches quote (and any job) when emails match", async () => {
    const email = testEmail("attach");
    const quoteId = await makeQuote({ email });
    const jobId = await makeJobForQuote({ quoteId });

    const res = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Quote Owner", email, attachQuoteId: quoteId },
    });
    assert.equal(res.status, 201);
    track.customer(res.body.customer.customerId);
    assert.equal(res.body.attachedQuoteId, quoteId);

    const [quoteRow] = await db
      .select({ customerId: quoteRequestsTable.customerId })
      .from(quoteRequestsTable)
      .where(eq(quoteRequestsTable.id, quoteId));
    assert.equal(quoteRow.customerId, res.body.customer.customerId);

    const [jobRow] = await db
      .select({ customerId: jobsTable.customerId })
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId));
    assert.equal(jobRow.customerId, res.body.customer.customerId);
  });

  test("attachQuoteId is ignored (returns null) when emails do not match", async () => {
    const quoteOwnerEmail = testEmail("quote-owner");
    const wrongEmail = testEmail("wrong-claimer");
    const quoteId = await makeQuote({ email: quoteOwnerEmail });

    const res = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Wrong Claimer", email: wrongEmail, attachQuoteId: quoteId },
    });
    assert.equal(res.status, 201);
    track.customer(res.body.customer.customerId);
    assert.equal(
      res.body.attachedQuoteId,
      null,
      "Quote with mismatched email must not be attached",
    );

    const [quoteRow] = await db
      .select({ customerId: quoteRequestsTable.customerId })
      .from(quoteRequestsTable)
      .where(eq(quoteRequestsTable.id, quoteId));
    assert.equal(quoteRow.customerId, null, "Quote ownership must remain unchanged");
  });
});

describe("POST /api/customer-auth/login", () => {
  test("logs in by email + password and sets a session cookie", async () => {
    const email = testEmail("login");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Login Tester", email },
    });
    assert.equal(signup.status, 201);
    track.customer(signup.body.customer.customerId);
    const password = signup.body.generatedPassword;

    const jar = new CookieJar();
    const res = await api("/api/customer-auth/login", {
      method: "POST",
      cookieJar: jar,
      body: { identifier: email, password },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.customer.email, email);

    const me = await api("/api/customer-auth/me", { cookieJar: jar });
    assert.equal(me.status, 200);
    assert.equal(me.body.customer.customerId, signup.body.customer.customerId);
  });

  test("logs in by +username and supports the legacy `email` body field", async () => {
    const email = testEmail("loginu");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Loginu Tester", email },
    });
    assert.equal(signup.status, 201);
    track.customer(signup.body.customer.customerId);
    const password = signup.body.generatedPassword;

    const jar = new CookieJar();
    const res = await api("/api/customer-auth/login", {
      method: "POST",
      cookieJar: jar,
      body: { username: signup.body.customer.username, password },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.customer.username, signup.body.customer.username);
  });

  test("rejects missing credentials with 400", async () => {
    const res = await api("/api/customer-auth/login", {
      method: "POST",
      body: { identifier: "" },
    });
    assert.equal(res.status, 400);
  });

  test("rejects wrong password with 401", async () => {
    const email = testEmail("wrongpw");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Wrong Pw", email },
    });
    track.customer(signup.body.customer.customerId);

    const res = await api("/api/customer-auth/login", {
      method: "POST",
      body: { identifier: email, password: "definitely-not-it" },
    });
    assert.equal(res.status, 401);
    assert.match(res.body.error, /invalid credentials/i);
  });

  test("rejects unknown identifier with 401", async () => {
    const res = await api("/api/customer-auth/login", {
      method: "POST",
      body: { identifier: testEmail("nobody"), password: "whatever" },
    });
    assert.equal(res.status, 401);
  });

  test("rejects login for a contact that has no password set", async () => {
    // Manually insert a passwordless contact to simulate quote-only "ghost" customers.
    const email = testEmail("nopw");
    const [c] = await db
      .insert(customersTable)
      .values({ fullName: "Ghost", email, phone: null, username: null, passwordHash: null })
      .returning();
    track.customer(c.id);

    const res = await api("/api/customer-auth/login", {
      method: "POST",
      body: { identifier: email, password: "anything" },
    });
    assert.equal(res.status, 401);
  });
});

describe("POST /api/customer-auth/logout", () => {
  test("clears the session cookie so /me becomes 401", async () => {
    const email = testEmail("logout");
    const jar = new CookieJar();
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      cookieJar: jar,
      body: { fullName: "Logout Tester", email },
    });
    track.customer(signup.body.customer.customerId);

    const me1 = await api("/api/customer-auth/me", { cookieJar: jar });
    assert.equal(me1.status, 200);

    const res = await api("/api/customer-auth/logout", { method: "POST", cookieJar: jar });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const me2 = await api("/api/customer-auth/me", { cookieJar: jar });
    assert.equal(me2.status, 401);
  });
});

describe("GET /api/customer-auth/me", () => {
  test("returns 401 without a session cookie", async () => {
    const res = await api("/api/customer-auth/me");
    assert.equal(res.status, 401);
  });
});

describe("GET /api/customer-auth/check-username", () => {
  test("returns valid:false for a malformed username", async () => {
    const res = await api(`/api/customer-auth/check-username?username=${encodeURIComponent("ab")}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.valid, false);
    assert.equal(res.body.available, false);
  });

  test("returns available:false once the username is registered, true beforehand", async () => {
    const username = testUsername("check");

    const before = await api(
      `/api/customer-auth/check-username?username=${encodeURIComponent(username)}`,
    );
    assert.equal(before.status, 200);
    assert.equal(before.body.valid, true);
    assert.equal(before.body.available, true);

    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Check User", email: testEmail("check"), username },
    });
    assert.equal(signup.status, 201);
    track.customer(signup.body.customer.customerId);

    const after = await api(
      `/api/customer-auth/check-username?username=${encodeURIComponent(username)}`,
    );
    assert.equal(after.status, 200);
    assert.equal(after.body.available, false);
  });

  test("missing query param returns 400", async () => {
    const res = await api("/api/customer-auth/check-username");
    assert.equal(res.status, 400);
  });
});

describe("Auth email throttling", () => {
  const ORIGINAL_EMAIL_LIMIT = process.env.AUTH_EMAIL_RATE_PER_HOUR;
  const ORIGINAL_IP_LIMIT = process.env.AUTH_IP_RATE_PER_HOUR;

  before(() => {
    process.env.AUTH_EMAIL_RATE_PER_HOUR = "3";
    // High enough that per-recipient tests aren't accidentally blocked by the
    // per-IP counter (every test reuses 127.0.0.1).
    process.env.AUTH_IP_RATE_PER_HOUR = "1000";
  });
  after(() => {
    if (ORIGINAL_EMAIL_LIMIT === undefined) delete process.env.AUTH_EMAIL_RATE_PER_HOUR;
    else process.env.AUTH_EMAIL_RATE_PER_HOUR = ORIGINAL_EMAIL_LIMIT;
    if (ORIGINAL_IP_LIMIT === undefined) delete process.env.AUTH_IP_RATE_PER_HOUR;
    else process.env.AUTH_IP_RATE_PER_HOUR = ORIGINAL_IP_LIMIT;
  });
  beforeEach(() => {
    __resetIpHitsForTests();
  });

  async function countLogsFor(email: string, type: string): Promise<number> {
    const rows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(emailLogsTable)
      .where(
        sql`lower(${emailLogsTable.recipient}) = ${email.toLowerCase()} and ${emailLogsTable.emailType} = ${type}`,
      );
    return rows[0]?.n ?? 0;
  }

  /**
   * The signup endpoint fires its verification email as fire-and-forget, so
   * its email_logs row may not be written by the time the test starts looping.
   * Wait briefly for it to land, then clear all auth-related rows for this
   * recipient — that gives each throttle test a deterministic clean slate.
   */
  async function clearAuthEmailLogsFor(email: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 50));
    await db
      .delete(emailLogsTable)
      .where(
        sql`lower(${emailLogsTable.recipient}) = ${email.toLowerCase()} and ${emailLogsTable.emailType} in ('email_verification','password_reset','account_credentials')`,
      );
  }

  test("resend-verification: returns 429 once the per-recipient limit is reached", async () => {
    const email = testEmail("throttle-resend");
    const jar = new CookieJar();
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      cookieJar: jar,
      body: { fullName: "Resend Throttle", email },
    });
    assert.equal(signup.status, 201);
    track.customer(signup.body.customer.customerId);
    await clearAuthEmailLogsFor(email);

    // With AUTH_EMAIL_RATE_PER_HOUR=3 and a clean slate, three resends pass.
    for (let i = 0; i < 3; i++) {
      const ok = await api("/api/customer-auth/resend-verification", {
        method: "POST",
        cookieJar: jar,
      });
      assert.equal(ok.status, 200, `Attempt ${i + 1}/3 should succeed`);
    }

    // The next attempt must be throttled.
    const blocked = await api("/api/customer-auth/resend-verification", {
      method: "POST",
      cookieJar: jar,
    });
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.error, /too many/i);

    // And no new email_verification log row was written for the blocked call.
    const afterCount = await countLogsFor(email, "email_verification");
    assert.equal(afterCount, 3, "Throttled call must not enqueue another email");
  });

  test("forgot-password: returns 200 silently when throttled, with no extra email sent", async () => {
    const email = testEmail("throttle-forgot");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Forgot Throttle", email },
    });
    assert.equal(signup.status, 201);
    track.customer(signup.body.customer.customerId);
    await clearAuthEmailLogsFor(email);

    // With a clean slate, the first three forgot-password calls all succeed.
    for (let i = 0; i < 3; i++) {
      const r = await api("/api/customer-auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.success, true);
    }
    assert.equal(await countLogsFor(email, "password_reset"), 3);

    // 4th call should silently return 200 but NOT write another log row.
    const blocked = await api("/api/customer-auth/forgot-password", {
      method: "POST",
      body: { email },
    });
    assert.equal(blocked.status, 200);
    assert.equal(blocked.body.success, true);
    assert.equal(
      await countLogsFor(email, "password_reset"),
      3,
      "Throttled forgot-password must not send another email",
    );
  });

  test("email_verification and password_reset counts are pooled per recipient", async () => {
    const email = testEmail("throttle-mixed");
    const jar = new CookieJar();
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      cookieJar: jar,
      body: { fullName: "Mixed Throttle", email },
    });
    assert.equal(signup.status, 201);
    track.customer(signup.body.customer.customerId);
    await clearAuthEmailLogsFor(email);

    // 1 resend (verification) + 2 forgot-password calls = 3, hits the pooled
    // limit. The next call (a 4th send of either type) must be throttled.
    const r1 = await api("/api/customer-auth/resend-verification", {
      method: "POST",
      cookieJar: jar,
    });
    assert.equal(r1.status, 200);

    for (let i = 0; i < 2; i++) {
      const r = await api("/api/customer-auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      assert.equal(r.status, 200);
    }
    assert.equal(await countLogsFor(email, "password_reset"), 2);
    assert.equal(await countLogsFor(email, "email_verification"), 1);

    // The 4th request — a forgot-password — should be silently throttled
    // because the pooled counter (verification + reset) is at 3.
    const blocked = await api("/api/customer-auth/forgot-password", {
      method: "POST",
      body: { email },
    });
    assert.equal(blocked.status, 200, "still 200 to avoid info leakage");
    assert.equal(
      await countLogsFor(email, "password_reset"),
      2,
      "Mixed-type pooled limit should stop the 4th send",
    );
  });

  test("per-IP throttle blocks bursts across many different recipients", async () => {
    process.env.AUTH_IP_RATE_PER_HOUR = "2";
    __resetIpHitsForTests();
    try {
      // Three signed-up customers from the same IP (127.0.0.1 in tests).
      const customers = [];
      for (let i = 0; i < 3; i++) {
        const email = testEmail(`ip-throttle-${i}`);
        const jar = new CookieJar();
        const signup = await api("/api/customer-auth/signup", {
          method: "POST",
          cookieJar: jar,
          body: { fullName: `IP Throttle ${i}`, email },
        });
        assert.equal(signup.status, 201);
        track.customer(signup.body.customer.customerId);
        customers.push({ email, jar });
      }

      // First two resends from this IP should pass (limit=2).
      const a = await api("/api/customer-auth/resend-verification", {
        method: "POST",
        cookieJar: customers[0].jar,
      });
      assert.equal(a.status, 200);
      const b = await api("/api/customer-auth/resend-verification", {
        method: "POST",
        cookieJar: customers[1].jar,
      });
      assert.equal(b.status, 200);

      // Third resend, even to a brand-new recipient, must be IP-throttled.
      const c = await api("/api/customer-auth/resend-verification", {
        method: "POST",
        cookieJar: customers[2].jar,
      });
      assert.equal(c.status, 429);
    } finally {
      process.env.AUTH_IP_RATE_PER_HOUR = "1000";
      __resetIpHitsForTests();
    }
  });
});

// ─── Email verification ─────────────────────────────────────────────────────

describe("POST /api/customer-auth/verify-email", () => {
  test("happy path: marks the customer's email as verified", async () => {
    const email = testEmail("verify-ok");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Verify Ok", email },
    });
    assert.equal(signup.status, 201);
    const customerId = signup.body.customer.customerId;
    track.customer(customerId);

    // Pre-condition: not verified yet.
    const before = await db
      .select({ emailVerifiedAt: customersTable.emailVerifiedAt })
      .from(customersTable)
      .where(eq(customersTable.id, customerId));
    assert.equal(before[0].emailVerifiedAt, null);

    const token = signEmailVerificationToken(customerId, email);
    const res = await api("/api/customer-auth/verify-email", {
      method: "POST",
      body: { token },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.alreadyVerified, false);

    const after = await db
      .select({ emailVerifiedAt: customersTable.emailVerifiedAt })
      .from(customersTable)
      .where(eq(customersTable.id, customerId));
    assert.ok(after[0].emailVerifiedAt instanceof Date, "emailVerifiedAt should be set");
  });

  test("idempotent: re-verifying succeeds and reports alreadyVerified=true", async () => {
    const email = testEmail("verify-twice");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Verify Twice", email },
    });
    const customerId = signup.body.customer.customerId;
    track.customer(customerId);

    const token = signEmailVerificationToken(customerId, email);
    const first = await api("/api/customer-auth/verify-email", {
      method: "POST",
      body: { token },
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.alreadyVerified, false);

    const verifiedAtBefore = (
      await db
        .select({ emailVerifiedAt: customersTable.emailVerifiedAt })
        .from(customersTable)
        .where(eq(customersTable.id, customerId))
    )[0].emailVerifiedAt;

    const second = await api("/api/customer-auth/verify-email", {
      method: "POST",
      body: { token },
    });
    assert.equal(second.status, 200);
    assert.equal(second.body.success, true);
    assert.equal(second.body.alreadyVerified, true, "second call should report alreadyVerified");

    // Crucially, the timestamp must NOT be overwritten on re-verify.
    const verifiedAtAfter = (
      await db
        .select({ emailVerifiedAt: customersTable.emailVerifiedAt })
        .from(customersTable)
        .where(eq(customersTable.id, customerId))
    )[0].emailVerifiedAt;
    assert.equal(
      verifiedAtAfter?.getTime(),
      verifiedAtBefore?.getTime(),
      "Re-verify must not bump emailVerifiedAt",
    );
  });

  test("rejects when token email no longer matches the account email", async () => {
    const oldEmail = testEmail("verify-old");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Email Changer", email: oldEmail },
    });
    const customerId = signup.body.customer.customerId;
    track.customer(customerId);

    // Mint a token for the original email, then change the email under us.
    const token = signEmailVerificationToken(customerId, oldEmail);
    const newEmail = testEmail("verify-new");
    await db
      .update(customersTable)
      .set({ email: newEmail })
      .where(eq(customersTable.id, customerId));

    const res = await api("/api/customer-auth/verify-email", {
      method: "POST",
      body: { token },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /no longer valid/i);

    const row = await db
      .select({ emailVerifiedAt: customersTable.emailVerifiedAt })
      .from(customersTable)
      .where(eq(customersTable.id, customerId));
    assert.equal(row[0].emailVerifiedAt, null, "must NOT verify after email change");
  });

  test("rejects a wrong-purpose token (customer session token replayed as verification)", async () => {
    const email = testEmail("verify-wrong-purpose");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Wrong Purpose", email },
    });
    const customerId = signup.body.customer.customerId;
    track.customer(customerId);

    // A long-lived session token should NOT satisfy verify-email.
    const sessionToken = signCustomerToken({
      customerId,
      email,
      username: signup.body.customer.username,
      fullName: "Wrong Purpose",
    });

    const res = await api("/api/customer-auth/verify-email", {
      method: "POST",
      body: { token: sessionToken },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /invalid|expired/i);
  });

  test("rejects an expired verification token", async () => {
    const email = testEmail("verify-expired");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Verify Expired", email },
    });
    const customerId = signup.body.customer.customerId;
    track.customer(customerId);

    const expired = signExpiredVerificationToken(customerId, email);
    const res = await api("/api/customer-auth/verify-email", {
      method: "POST",
      body: { token: expired },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /invalid or has expired/i);
  });

  test("rejects a missing or empty token with 400", async () => {
    const r1 = await api("/api/customer-auth/verify-email", { method: "POST", body: {} });
    assert.equal(r1.status, 400);

    const r2 = await api("/api/customer-auth/verify-email", {
      method: "POST",
      body: { token: "   " },
    });
    assert.equal(r2.status, 400);
  });

  test("rejects a token for a customer that no longer exists", async () => {
    const ghostId = 999_999_111;
    const token = signEmailVerificationToken(ghostId, "ghost@teemer-tests.local");
    const res = await api("/api/customer-auth/verify-email", {
      method: "POST",
      body: { token },
    });
    assert.equal(res.status, 400);
  });
});

describe("POST /api/customer-auth/resend-verification", () => {
  test("requires customer auth (401 without a session cookie)", async () => {
    const res = await api("/api/customer-auth/resend-verification", { method: "POST" });
    assert.equal(res.status, 401);
  });

  test("returns success when the signed-in customer is unverified", async () => {
    const email = testEmail("resend");
    const jar = new CookieJar();
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      cookieJar: jar,
      body: { fullName: "Resend Tester", email },
    });
    track.customer(signup.body.customer.customerId);

    const res = await api("/api/customer-auth/resend-verification", {
      method: "POST",
      cookieJar: jar,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    // Unverified path should NOT report alreadyVerified.
    assert.notEqual(res.body.alreadyVerified, true);
  });

  test("short-circuits with alreadyVerified=true when already verified", async () => {
    const email = testEmail("resend-verified");
    const jar = new CookieJar();
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      cookieJar: jar,
      body: { fullName: "Already Verified", email },
    });
    const customerId = signup.body.customer.customerId;
    track.customer(customerId);

    // Verify via the real endpoint so we exercise the same code path users hit.
    const token = signEmailVerificationToken(customerId, email);
    await api("/api/customer-auth/verify-email", { method: "POST", body: { token } });

    const res = await api("/api/customer-auth/resend-verification", {
      method: "POST",
      cookieJar: jar,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.alreadyVerified, true);
  });
});

// ─── Password reset ─────────────────────────────────────────────────────────

describe("POST /api/customer-auth/forgot-password", () => {
  test("returns 200 for a known email (no enumeration leak)", async () => {
    const email = testEmail("forgot-known");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Forgot Known", email },
    });
    track.customer(signup.body.customer.customerId);

    const res = await api("/api/customer-auth/forgot-password", {
      method: "POST",
      body: { email },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
  });

  test("returns 200 with the SAME body for an unknown email (no enumeration)", async () => {
    const unknown = testEmail("forgot-nobody");
    const res = await api("/api/customer-auth/forgot-password", {
      method: "POST",
      body: { email: unknown },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
  });

  test("returns 200 for an obviously malformed email (no enumeration)", async () => {
    const res = await api("/api/customer-auth/forgot-password", {
      method: "POST",
      body: { email: "not-an-email" },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
  });

  test("returns 200 for a passwordless ghost contact (no enumeration)", async () => {
    // Ghost (no password) — shape is identical to "unknown email".
    const email = testEmail("forgot-ghost");
    const [c] = await db
      .insert(customersTable)
      .values({ fullName: "Ghost", email, phone: null, username: null, passwordHash: null })
      .returning();
    track.customer(c.id);

    const res = await api("/api/customer-auth/forgot-password", {
      method: "POST",
      body: { email },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
  });
});

describe("GET /api/customer-auth/reset-password/check", () => {
  test("returns valid:true with the email for a freshly minted token", async () => {
    const email = testEmail("check-ok");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Check Ok", email },
    });
    const customerId = signup.body.customer.customerId;
    track.customer(customerId);

    const [row] = await db
      .select({ passwordHash: customersTable.passwordHash })
      .from(customersTable)
      .where(eq(customersTable.id, customerId));
    const token = signPasswordResetToken(customerId, row.passwordHash!);

    const res = await api(
      `/api/customer-auth/reset-password/check?token=${encodeURIComponent(token)}`,
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.email, email);
  });

  test("returns valid:false for an expired token", async () => {
    const email = testEmail("check-expired");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Check Expired", email },
    });
    const customerId = signup.body.customer.customerId;
    track.customer(customerId);

    const [row] = await db
      .select({ passwordHash: customersTable.passwordHash })
      .from(customersTable)
      .where(eq(customersTable.id, customerId));
    const expired = signExpiredResetToken(customerId, (row.passwordHash ?? "").slice(0, 16));

    const res = await api(
      `/api/customer-auth/reset-password/check?token=${encodeURIComponent(expired)}`,
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.valid, false);
  });

  test("returns 400 when the token query parameter is missing", async () => {
    const res = await api("/api/customer-auth/reset-password/check");
    assert.equal(res.status, 400);
    assert.equal(res.body.valid, false);
  });
});

describe("POST /api/customer-auth/reset-password", () => {
  test("happy path: rotates the password, auto-logs the customer in, lets them sign in with the new one", async () => {
    const email = testEmail("reset-ok");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Reset Ok", email },
    });
    const customerId = signup.body.customer.customerId;
    track.customer(customerId);
    const oldPassword = signup.body.generatedPassword;

    const [row] = await db
      .select({ passwordHash: customersTable.passwordHash })
      .from(customersTable)
      .where(eq(customersTable.id, customerId));
    const token = signPasswordResetToken(customerId, row.passwordHash!);

    const newPassword = "NewSecret-" + uniqueSuffix();
    const jar = new CookieJar();
    const res = await api("/api/customer-auth/reset-password", {
      method: "POST",
      cookieJar: jar,
      body: { token, password: newPassword },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    assert.equal(res.body.customer.customerId, customerId);

    // Auto-login: the same jar should now access /me without a separate login.
    const me = await api("/api/customer-auth/me", { cookieJar: jar });
    assert.equal(me.status, 200, "reset should auto-log the customer in");
    assert.equal(me.body.customer.customerId, customerId);

    // The new password actually works for a fresh login.
    const loginNew = await api("/api/customer-auth/login", {
      method: "POST",
      body: { identifier: email, password: newPassword },
    });
    assert.equal(loginNew.status, 200);

    // The old password no longer works.
    const loginOld = await api("/api/customer-auth/login", {
      method: "POST",
      body: { identifier: email, password: oldPassword },
    });
    assert.equal(loginOld.status, 401);
  });

  test("single-use guard: re-using the same token after a successful reset is rejected", async () => {
    const email = testEmail("reset-reuse");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Reset Reuse", email },
    });
    const customerId = signup.body.customer.customerId;
    track.customer(customerId);

    const [row] = await db
      .select({ passwordHash: customersTable.passwordHash })
      .from(customersTable)
      .where(eq(customersTable.id, customerId));
    const token = signPasswordResetToken(customerId, row.passwordHash!);

    const first = await api("/api/customer-auth/reset-password", {
      method: "POST",
      body: { token, password: "FirstNew-" + uniqueSuffix() },
    });
    assert.equal(first.status, 200);

    // Replay the same token — the hashKey embedded in it no longer matches
    // the (now rotated) password hash, so it must be rejected.
    const second = await api("/api/customer-auth/reset-password", {
      method: "POST",
      body: { token, password: "SecondNew-" + uniqueSuffix() },
    });
    assert.equal(second.status, 400);
    assert.match(second.body.error, /already been used/i);

    // The pre-flight check route should report the same single-use semantics.
    const check = await api(
      `/api/customer-auth/reset-password/check?token=${encodeURIComponent(token)}`,
    );
    assert.equal(check.body.valid, false);
    assert.match(check.body.error, /already been used/i);
  });

  test("rejects passwords shorter than 8 characters", async () => {
    const email = testEmail("reset-short");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Reset Short", email },
    });
    const customerId = signup.body.customer.customerId;
    track.customer(customerId);

    const [row] = await db
      .select({ passwordHash: customersTable.passwordHash })
      .from(customersTable)
      .where(eq(customersTable.id, customerId));
    const token = signPasswordResetToken(customerId, row.passwordHash!);

    const res = await api("/api/customer-auth/reset-password", {
      method: "POST",
      body: { token, password: "abc12" },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /at least 8/i);
  });

  test("rejects an empty password", async () => {
    const email = testEmail("reset-empty");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Reset Empty", email },
    });
    const customerId = signup.body.customer.customerId;
    track.customer(customerId);

    const [row] = await db
      .select({ passwordHash: customersTable.passwordHash })
      .from(customersTable)
      .where(eq(customersTable.id, customerId));
    const token = signPasswordResetToken(customerId, row.passwordHash!);

    const res = await api("/api/customer-auth/reset-password", {
      method: "POST",
      body: { token, password: "" },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /at least 8/i);
  });

  test("rejects a missing token with 400", async () => {
    const res = await api("/api/customer-auth/reset-password", {
      method: "POST",
      body: { password: "longenoughpw" },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /missing reset token/i);
  });

  test("rejects an expired reset token", async () => {
    const email = testEmail("reset-expired");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Reset Expired", email },
    });
    const customerId = signup.body.customer.customerId;
    track.customer(customerId);

    const [row] = await db
      .select({ passwordHash: customersTable.passwordHash })
      .from(customersTable)
      .where(eq(customersTable.id, customerId));
    const expired = signExpiredResetToken(customerId, (row.passwordHash ?? "").slice(0, 16));

    const res = await api("/api/customer-auth/reset-password", {
      method: "POST",
      body: { token: expired, password: "AnotherLongPw1" },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /invalid or has expired/i);
  });

  test("rejects a wrong-purpose token (verification token replayed as reset)", async () => {
    const email = testEmail("reset-wrong-purpose");
    const signup = await api("/api/customer-auth/signup", {
      method: "POST",
      body: { fullName: "Reset Wrong Purpose", email },
    });
    const customerId = signup.body.customer.customerId;
    track.customer(customerId);

    // Mint an email-verification token and try to use it as a reset token.
    const verifToken = signEmailVerificationToken(customerId, email);
    const res = await api("/api/customer-auth/reset-password", {
      method: "POST",
      body: { token: verifToken, password: "AnotherLongPw1" },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /invalid or has expired/i);
  });
});
