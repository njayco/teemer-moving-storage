import http, { type Server } from "node:http";
import type { AddressInfo } from "node:net";
import crypto from "node:crypto";
import { db } from "@workspace/db";
import {
  customersTable,
  quoteRequestsTable,
  jobsTable,
  paymentRequestsTable,
  paymentsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, inArray, like } from "drizzle-orm";
import app from "../app";
import { signToken, hashPassword } from "../lib/auth";

let server: Server | null = null;
let baseUrl = "";

const trash: {
  payments: Set<number>;
  paymentRequests: Set<number>;
  jobs: Set<number>;
  quotes: Set<number>;
  customers: Set<number>;
  adminUsers: Set<number>;
} = {
  payments: new Set(),
  paymentRequests: new Set(),
  jobs: new Set(),
  quotes: new Set(),
  customers: new Set(),
  adminUsers: new Set(),
};

export interface TestServerHandle {
  baseUrl: string;
  server: Server;
}

export async function startTestServer(): Promise<TestServerHandle> {
  if (server && baseUrl) return { baseUrl, server };
  server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server!.once("error", reject);
    server!.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
  return { baseUrl, server };
}

export async function stopTestServer(): Promise<void> {
  await cleanupAllTrash();
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
    baseUrl = "";
  }
}

// ─── Trash bin: track ids we create so we can delete them on teardown ───────

export const track = {
  customer: (id: number) => trash.customers.add(id),
  quote: (id: number) => trash.quotes.add(id),
  job: (id: number) => trash.jobs.add(id),
  paymentRequest: (id: number) => trash.paymentRequests.add(id),
  payment: (id: number) => trash.payments.add(id),
  adminUser: (id: number) => trash.adminUsers.add(id),
};

async function cleanupAllTrash() {
  if (trash.payments.size > 0) {
    await db.delete(paymentsTable).where(inArray(paymentsTable.id, [...trash.payments]));
    trash.payments.clear();
  }
  if (trash.paymentRequests.size > 0) {
    await db
      .delete(paymentRequestsTable)
      .where(inArray(paymentRequestsTable.id, [...trash.paymentRequests]));
    trash.paymentRequests.clear();
  }
  if (trash.jobs.size > 0) {
    await db.delete(jobsTable).where(inArray(jobsTable.id, [...trash.jobs]));
    trash.jobs.clear();
  }
  if (trash.quotes.size > 0) {
    await db.delete(quoteRequestsTable).where(inArray(quoteRequestsTable.id, [...trash.quotes]));
    trash.quotes.clear();
  }
  // Sweep payments/payment_requests/quotes/jobs that reference our customers
  // (covers anything created by webhook side-effects we may not have tracked).
  const customerIds = [...trash.customers];
  if (customerIds.length > 0) {
    await db
      .delete(paymentsTable)
      .where(inArray(paymentsTable.customerId, customerIds));
    await db
      .delete(paymentRequestsTable)
      .where(inArray(paymentRequestsTable.customerId, customerIds));
    await db.delete(jobsTable).where(inArray(jobsTable.customerId, customerIds));
    await db
      .delete(quoteRequestsTable)
      .where(inArray(quoteRequestsTable.customerId, customerIds));
    await db.delete(customersTable).where(inArray(customersTable.id, customerIds));
    trash.customers.clear();
  }
  if (trash.adminUsers.size > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, [...trash.adminUsers]));
    trash.adminUsers.clear();
  }
}

// ─── Unique tags for this test run ──────────────────────────────────────────

const RUN_TAG = `tt${Date.now().toString(36)}${crypto.randomBytes(2).toString("hex")}`;
let counter = 0;
export function uniqueSuffix(prefix = ""): string {
  counter += 1;
  return `${prefix}${RUN_TAG}${counter}`;
}
export function testEmail(label: string): string {
  return `${label}.${uniqueSuffix()}@teemer-tests.local`;
}
export function testUsername(label: string): string {
  // Strip non-alphanumeric to satisfy the +[A-Za-z0-9_]{3,30} rule.
  const safe = `${label}${RUN_TAG}${counter += 1}`.replace(/[^A-Za-z0-9_]/g, "");
  return `+${safe.slice(0, 28)}`;
}

// ─── Tiny fetch wrapper that preserves cookies for "session" tests ──────────

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  cookieJar?: CookieJar;
}

export class CookieJar {
  private jar = new Map<string, string>();

  capture(setCookie: string | null) {
    if (!setCookie) return;
    // Naive split — Express only sets a single cookie per call, and our
    // multi-cookie scenarios use multiple set-cookie headers (handled by
    // `getSetCookie` on Headers below).
    const [pair] = setCookie.split(";");
    const [name, ...rest] = pair.split("=");
    if (!name) return;
    if (rest.length === 0) {
      // Browsers treat "name=" as a clear; keep that semantics.
      this.jar.delete(name.trim());
      return;
    }
    const value = rest.join("=").trim();
    if (value === "") this.jar.delete(name.trim());
    else this.jar.set(name.trim(), value);
  }

  captureAll(headers: Headers) {
    const all = headers.getSetCookie?.() ?? [];
    for (const c of all) this.capture(c);
  }

  cookieHeader(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

export async function api(
  path: string,
  opts: FetchOptions = {},
): Promise<{ status: number; body: any; headers: Headers }> {
  const handle = await startTestServer();
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (opts.cookieJar) {
    const cookie = opts.cookieJar.cookieHeader();
    if (cookie) headers["Cookie"] = cookie;
  }

  const res = await fetch(`${handle.baseUrl}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (opts.cookieJar) opts.cookieJar.captureAll(res.headers);

  const ct = res.headers.get("content-type") ?? "";
  let body: any = null;
  if (ct.includes("application/json")) {
    body = await res.json().catch(() => null);
  } else {
    body = await res.text().catch(() => null);
  }
  return { status: res.status, body, headers: res.headers };
}

// ─── Helpers for the admin tests ────────────────────────────────────────────

export async function makeAdminUser(opts?: { role?: "admin" | "move_captain" }) {
  const role = opts?.role ?? "admin";
  const email = testEmail("admin");
  const passwordHash = await hashPassword("AdminPass!" + uniqueSuffix());
  const [u] = await db
    .insert(usersTable)
    .values({ name: "Test Admin", email, passwordHash, role })
    .returning();
  track.adminUser(u.id);
  return u;
}

export function adminAuthHeader(user: { id: number; email: string; role: string; name: string }) {
  const token = signToken({ userId: user.id, email: user.email, role: user.role, name: user.name });
  return { Authorization: `Bearer ${token}` };
}

// ─── Quote helper ──────────────────────────────────────────────────────────

export async function makeQuote(opts: {
  email: string;
  contactName?: string;
  phone?: string;
  moveDate?: string;
  totalEstimate?: number;
  customerId?: number | null;
}): Promise<number> {
  const [q] = await db
    .insert(quoteRequestsTable)
    .values({
      contactName: opts.contactName ?? "Test Customer",
      email: opts.email,
      phone: opts.phone ?? "555-555-1212",
      moveDate: opts.moveDate ?? "2099-01-01",
      moveType: "local",
      originAddress: "123 A St",
      destinationAddress: "456 B St",
      pickupAddress: "123 A St",
      dropoffAddress: "456 B St",
      totalEstimate: opts.totalEstimate ?? 1500,
      customerId: opts.customerId ?? null,
    })
    .returning();
  track.quote(q.id);
  return q.id;
}

export async function makeJobForQuote(opts: {
  quoteId: number;
  customerId?: number | null;
  customer?: string;
}): Promise<number> {
  const [j] = await db
    .insert(jobsTable)
    .values({
      jobId: `JOB-T-${uniqueSuffix()}`,
      customer: opts.customer ?? "Test Customer",
      pickupLocation: "123 A St",
      destination: "456 B St",
      moveType: "local",
      dateTime: "2099-01-01T09:00",
      estimatedPayout: 1500,
      quoteId: opts.quoteId,
      customerId: opts.customerId ?? null,
    })
    .returning();
  track.job(j.id);
  return j.id;
}
