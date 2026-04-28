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

export interface AuthPayload {
  userId: number;
  email: string;
  role: string;
  name: string;
}

export interface CustomerAuthPayload {
  customerId: number;
  email: string;
  username: string;
  fullName: string;
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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyCustomerToken(token: string): CustomerAuthPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as CustomerAuthPayload;
    if (typeof decoded?.customerId !== "number") return null;
    return decoded;
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

const USERNAME_REGEX = /^\+[A-Za-z0-9_]{3,30}$/;
export function isValidUsername(value: unknown): value is string {
  return typeof value === "string" && USERNAME_REGEX.test(value);
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

/**
 * Build a Stripe-derived confirmation number formatted as TM-XXXXXXXXXX
 * (10 uppercase alphanumeric chars from the PaymentIntent ID).
 */
export function buildConfirmationNumber(paymentIntentId: string | null | undefined): string {
  const id = (paymentIntentId ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const slice = id.slice(-10).padStart(10, "X");
  return `TM-${slice}`;
}
