import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "node:crypto";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return "teemer-dev-secret-local-only";
}
const JWT_SECRET = getJwtSecret();
const SALT_ROUNDS = 10;
const TOKEN_COOKIE = "teemer_auth";
const CUSTOMER_TOKEN_COOKIE = "teemer_customer_auth";
const TOKEN_EXPIRY = "7d";

const USER_SESSION_PURPOSE = "user_session";
const CUSTOMER_SESSION_PURPOSE = "customer_session";

export interface AuthPayload {
  userId: number;
  email: string;
  role: string;
  name: string;
}

interface SignedAuthPayload extends AuthPayload {
  purpose: typeof USER_SESSION_PURPOSE;
}

export interface CustomerAuthPayload {
  customerId: number;
  email: string;
  username: string;
  fullName: string;
}

interface SignedCustomerAuthPayload extends CustomerAuthPayload {
  purpose: typeof CUSTOMER_SESSION_PURPOSE;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      customer?: CustomerAuthPayload;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: AuthPayload): string {
  const signed: SignedAuthPayload = { ...payload, purpose: USER_SESSION_PURPOSE };
  return jwt.sign(signed, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Partial<SignedAuthPayload>;
    // Strict purpose check prevents token-confusion: tokens minted for any other
    // purpose (customer session, email verification, password reset) must not
    // satisfy admin/captain auth. Tokens missing the purpose claim are also
    // rejected — legacy admin sessions should re-login after this upgrade.
    if (decoded?.purpose !== USER_SESSION_PURPOSE) return null;
    if (typeof decoded.userId !== "number") return null;
    if (typeof decoded.email !== "string") return null;
    if (typeof decoded.role !== "string") return null;
    if (typeof decoded.name !== "string") return null;
    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(TOKEN_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
}

function extractToken(req: Request): string | null {
  if (req.cookies?.[TOKEN_COOKIE]) return req.cookies[TOKEN_COOKIE];
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.user = payload;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.user = payload;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}

export function requireCaptainOrAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin" && req.user?.role !== "move_captain") {
      res.status(403).json({ error: "Admin or Move Captain access required" });
      return;
    }
    next();
  });
}

// ─── Customer auth ─────────────────────────────────────────────────────────

export function signCustomerToken(payload: CustomerAuthPayload): string {
  const signed: SignedCustomerAuthPayload = { ...payload, purpose: CUSTOMER_SESSION_PURPOSE };
  return jwt.sign(signed, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyCustomerToken(token: string): CustomerAuthPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Partial<SignedCustomerAuthPayload>;
    // Strict purpose check: a JWT minted as an email-verification token or
    // password-reset token also contains `customerId` and is signed with the
    // same secret. Without this guard, a one-time token could be replayed as
    // a long-lived session via the `x-customer-authorization` header.
    if (decoded?.purpose !== CUSTOMER_SESSION_PURPOSE) return null;
    if (typeof decoded.customerId !== "number") return null;
    if (typeof decoded.email !== "string") return null;
    if (typeof decoded.username !== "string") return null;
    if (typeof decoded.fullName !== "string") return null;
    return {
      customerId: decoded.customerId,
      email: decoded.email,
      username: decoded.username,
      fullName: decoded.fullName,
    };
  } catch {
    return null;
  }
}

export function setCustomerAuthCookie(res: Response, token: string) {
  res.cookie(CUSTOMER_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearCustomerAuthCookie(res: Response) {
  res.clearCookie(CUSTOMER_TOKEN_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
}

function extractCustomerToken(req: Request): string | null {
  if (req.cookies?.[CUSTOMER_TOKEN_COOKIE]) return req.cookies[CUSTOMER_TOKEN_COOKIE];
  const auth = req.headers["x-customer-authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export function optionalCustomerAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractCustomerToken(req);
  if (token) {
    const payload = verifyCustomerToken(token);
    if (payload) req.customer = payload;
  }
  next();
}

export function requireCustomer(req: Request, res: Response, next: NextFunction) {
  const token = extractCustomerToken(req);
  if (!token) {
    res.status(401).json({ error: "Customer authentication required" });
    return;
  }
  const payload = verifyCustomerToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired customer session" });
    return;
  }
  req.customer = payload;
  next();
}

// ─── Customer username + password generation ───────────────────────────────

// Username core (after the leading "+"):
//   - At least 2 characters
//   - Only letters, digits, underscore, or period
//   - Period cannot be the last character
const USERNAME_CORE_REGEX = /^[A-Za-z0-9_.]{2,}$/;
export function isValidUsername(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const withPlus = value.startsWith("+") ? value : `+${value}`;
  const core = withPlus.slice(1);
  if (!USERNAME_CORE_REGEX.test(core)) return false;
  if (core.endsWith(".")) return false;
  return true;
}

export function normalizeUsername(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

/**
 * Build a username candidate from the customer's full name.
 * Strips non-alphanumeric chars, lowercases, prefixes with "+".
 * Caller is responsible for adding a uniqueness suffix on collision.
 */
export function suggestUsernameFromName(fullName: string): string {
  const base = (fullName || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 24);
  return `+${base || "customer"}`;
}

/**
 * Random alphanumeric (mixed case + digits) password — 12 chars by default.
 * Uses Node's crypto for safety; avoids ambiguous characters.
 */
export function generateRandomPassword(length: number = 12): string {
  // 56-char alphabet (excludes 0/O/1/l/I to avoid confusion when typing).
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[buf[i] % alphabet.length];
  }
  return out;
}

// ─── Email verification + password reset tokens ────────────────────────────
//
// We use short-lived signed JWTs (stateless — no extra DB table needed).
// • Verification tokens encode { purpose, customerId, email } and expire in 24h.
//   Embedding the email means the token is invalidated if the address changes
//   before it's used.
// • Reset tokens encode { purpose, customerId, hashKey } and expire in 1h.
//   `hashKey` is the first 16 chars of the current bcrypt hash. Once the user
//   actually changes their password, the hash (and thus hashKey) changes, so
//   any previously issued reset tokens are automatically invalidated — this
//   gives us single-use semantics without any DB writes.

const EMAIL_VERIFICATION_PURPOSE = "customer_email_verification";
const PASSWORD_RESET_PURPOSE = "customer_password_reset";
const EMAIL_VERIFICATION_TOKEN_EXPIRY = "24h";
const PASSWORD_RESET_TOKEN_EXPIRY = "1h";

interface EmailVerificationTokenPayload {
  purpose: typeof EMAIL_VERIFICATION_PURPOSE;
  customerId: number;
  email: string;
}

interface PasswordResetTokenPayload {
  purpose: typeof PASSWORD_RESET_PURPOSE;
  customerId: number;
  hashKey: string;
}

export function signEmailVerificationToken(customerId: number, email: string): string {
  const payload: EmailVerificationTokenPayload = {
    purpose: EMAIL_VERIFICATION_PURPOSE,
    customerId,
    email: email.toLowerCase(),
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EMAIL_VERIFICATION_TOKEN_EXPIRY });
}

export function verifyEmailVerificationToken(
  token: string,
): { customerId: number; email: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as EmailVerificationTokenPayload;
    if (decoded?.purpose !== EMAIL_VERIFICATION_PURPOSE) return null;
    if (typeof decoded.customerId !== "number") return null;
    if (typeof decoded.email !== "string") return null;
    return { customerId: decoded.customerId, email: decoded.email };
  } catch {
    return null;
  }
}

export function passwordResetHashKey(passwordHash: string | null | undefined): string {
  return (passwordHash ?? "").slice(0, 16);
}

export function signPasswordResetToken(customerId: number, passwordHash: string): string {
  const payload: PasswordResetTokenPayload = {
    purpose: PASSWORD_RESET_PURPOSE,
    customerId,
    hashKey: passwordResetHashKey(passwordHash),
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: PASSWORD_RESET_TOKEN_EXPIRY });
}

export function verifyPasswordResetToken(
  token: string,
): { customerId: number; hashKey: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as PasswordResetTokenPayload;
    if (decoded?.purpose !== PASSWORD_RESET_PURPOSE) return null;
    if (typeof decoded.customerId !== "number") return null;
    if (typeof decoded.hashKey !== "string") return null;
    return { customerId: decoded.customerId, hashKey: decoded.hashKey };
  } catch {
    return null;
  }
}

/**
 * Build a Stripe-derived confirmation number formatted as TM-XXXXXXXXXX
 * (10 uppercase alphanumeric chars from the PaymentIntent ID).
 */
export function buildConfirmationNumber(paymentIntentId: string | null | undefined): string {
  const id = (paymentIntentId ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const slice = id.slice(-10).padStart(10, "X");
  return `TM-${slice}`;
}
