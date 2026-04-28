import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@workspace/db";
import { customersTable, paymentsTable } from "@workspace/db/schema";
import {
  startTestServer,
  stopTestServer,
  api,
  testEmail,
  testUsername,
  uniqueSuffix,
  makeAdminUser,
  adminAuthHeader,
  makeQuote,
  makeJobForQuote,
  track,
} from "./test-helpers.js";
import { hashPassword } from "../lib/auth";

before(async () => {
  await startTestServer();
});
after(async () => {
  await stopTestServer();
});

async function createCustomerWithAccount(opts?: {
  fullName?: string;
  email?: string;
  username?: string;
  withPassword?: boolean;
}) {
  const fullName = opts?.fullName ?? "Test Customer";
  const email = opts?.email ?? testEmail("payreq");
  const username = opts?.username ?? testUsername("payreq");
  const passwordHash = opts?.withPassword === false ? null : await hashPassword("Test1234!");
  const [c] = await db
    .insert(customersTable)
    .values({ fullName, email, phone: "555-555-1212", username, passwordHash })
    .returning();
  track.customer(c.id);
  return c;
}

// ─── /api/admin/payment-requests creation ───────────────────────────────────

describe("POST /api/admin/payment-requests", () => {
  test("creates a payment request when given a valid customerId and amount", async () => {
    const admin = await makeAdminUser();
    const customer = await createCustomerWithAccount();

    const res = await api("/api/admin/payment-requests", {
      method: "POST",
      headers: adminAuthHeader(admin),
      body: { customerId: customer.id, amountCents: 12500, description: "Final balance" },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    track.paymentRequest(res.body.id);

    assert.equal(res.body.customerId, customer.id);
    assert.equal(res.body.amountCents, 12500);
    assert.equal(res.body.description, "Final balance");
    assert.equal(res.body.status, "pending");
    assert.equal(res.body.createdByUserId, admin.id);
    assert.equal(res.body.customer.id, customer.id);
    assert.match(res.body.payUrl, /\/account\/payment-requests\/\d+\/pay$/);
  });

  test("creates a payment request when given a +username instead of customerId", async () => {
    const admin = await makeAdminUser();
    const customer = await createCustomerWithAccount();

    const res = await api("/api/admin/payment-requests", {
      method: "POST",
      headers: adminAuthHeader(admin),
      body: { username: customer.username, amountCents: 5000, description: "Add-on services" },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    track.paymentRequest(res.body.id);
    assert.equal(res.body.customerId, customer.id);
  });

  test("requires authentication (401 without a token)", async () => {
    const customer = await createCustomerWithAccount();
    const res = await api("/api/admin/payment-requests", {
      method: "POST",
      body: { customerId: customer.id, amountCents: 100, description: "x" },
    });
    assert.equal(res.status, 401);
  });

  test("rejects non-admin roles with 403", async () => {
    const captain = await makeAdminUser({ role: "move_captain" });
    const customer = await createCustomerWithAccount();
    const res = await api("/api/admin/payment-requests", {
      method: "POST",
      headers: adminAuthHeader(captain),
      body: { customerId: customer.id, amountCents: 100, description: "x" },
    });
    assert.equal(res.status, 403);
  });

  test("rejects when description is missing", async () => {
    const admin = await makeAdminUser();
    const customer = await createCustomerWithAccount();
    const res = await api("/api/admin/payment-requests", {
      method: "POST",
      headers: adminAuthHeader(admin),
      body: { customerId: customer.id, amountCents: 500, description: "  " },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /description/i);
  });

  test("rejects amounts under $1.00 (100 cents)", async () => {
    const admin = await makeAdminUser();
    const customer = await createCustomerWithAccount();
    const res = await api("/api/admin/payment-requests", {
      method: "POST",
      headers: adminAuthHeader(admin),
      body: { customerId: customer.id, amountCents: 50, description: "Tiny" },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /\$1\.00/);
  });

  test("rejects when neither customerId nor username is supplied", async () => {
    const admin = await makeAdminUser();
    const res = await api("/api/admin/payment-requests", {
      method: "POST",
      headers: adminAuthHeader(admin),
      body: { amountCents: 1000, description: "Missing target" },
    });
    assert.equal(res.status, 400);
  });

  test("returns 404 when the customer does not exist", async () => {
    const admin = await makeAdminUser();
    const res = await api("/api/admin/payment-requests", {
      method: "POST",
      headers: adminAuthHeader(admin),
      body: { customerId: 999_999_999, amountCents: 1000, description: "Ghost" },
    });
    assert.equal(res.status, 404);
  });

  test("returns 409 when the target customer has no account (no password)", async () => {
    const admin = await makeAdminUser();
    const ghost = await createCustomerWithAccount({ withPassword: false });
    const res = await api("/api/admin/payment-requests", {
      method: "POST",
      headers: adminAuthHeader(admin),
      body: { customerId: ghost.id, amountCents: 1000, description: "Ghost" },
    });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /account/i);
  });
});

// ─── /api/admin/payment-requests listing + filter by status ─────────────────

describe("GET /api/admin/payment-requests", () => {
  test("requires admin auth", async () => {
    const r = await api("/api/admin/payment-requests");
    assert.equal(r.status, 401);
  });

  test("lists all by default and filters when ?status=pending is provided", async () => {
    const admin = await makeAdminUser();
    const customer = await createCustomerWithAccount();

    // Create three payment requests for the same customer.
    const created: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await api("/api/admin/payment-requests", {
        method: "POST",
        headers: adminAuthHeader(admin),
        body: { customerId: customer.id, amountCents: 1000 + i, description: `Item ${i}` },
      });
      assert.equal(r.status, 201);
      track.paymentRequest(r.body.id);
      created.push(r.body.id);
    }

    const all = await api("/api/admin/payment-requests", { headers: adminAuthHeader(admin) });
    assert.equal(all.status, 200);
    const ours = (all.body as Array<{ id: number }>).filter((p) => created.includes(p.id));
    assert.equal(ours.length, 3);

    const pending = await api("/api/admin/payment-requests?status=pending", {
      headers: adminAuthHeader(admin),
    });
    assert.equal(pending.status, 200);
    const oursPending = (pending.body as Array<{ id: number; status: string }>).filter((p) =>
      created.includes(p.id),
    );
    assert.equal(oursPending.length, 3);
    for (const r of oursPending) assert.equal(r.status, "pending");

    const paidOnly = await api("/api/admin/payment-requests?status=paid", {
      headers: adminAuthHeader(admin),
    });
    assert.equal(paidOnly.status, 200);
    const oursPaid = (paidOnly.body as Array<{ id: number }>).filter((p) =>
      created.includes(p.id),
    );
    assert.equal(oursPaid.length, 0, "Newly created requests should not appear in the paid list");
  });
});

// ─── /api/admin/payments listing/filtering ──────────────────────────────────

describe("GET /api/admin/payments", () => {
  test("requires admin auth", async () => {
    const r = await api("/api/admin/payments");
    assert.equal(r.status, 401);
  });

  test("returns payments and supports method + search filters", async () => {
    const admin = await makeAdminUser();
    const customer = await createCustomerWithAccount({ fullName: `Searchable ${uniqueSuffix()}` });
    const quoteId = await makeQuote({ email: customer.email, customerId: customer.id });
    const jobId = await makeJobForQuote({ quoteId, customerId: customer.id, customer: customer.fullName });

    // Insert three payments via the DB directly (this route is read-only).
    const stripeConfNum = `TM-${uniqueSuffix("S").slice(0, 10).toUpperCase().padEnd(10, "X")}`;
    const cashConfNum = `TM-${uniqueSuffix("C").slice(0, 10).toUpperCase().padEnd(10, "X")}`;
    const zelleConfNum = `TM-${uniqueSuffix("Z").slice(0, 10).toUpperCase().padEnd(10, "X")}`;

    const inserted = await db
      .insert(paymentsTable)
      .values([
        {
          jobId,
          customerId: customer.id,
          type: "deposit",
          method: "stripe",
          amount: 50,
          reference: `cs_test_${uniqueSuffix()}`,
          confirmationNumber: stripeConfNum,
        },
        {
          jobId,
          customerId: customer.id,
          type: "remaining_balance",
          method: "cash",
          amount: 100,
          reference: null,
          confirmationNumber: cashConfNum,
        },
        {
          jobId,
          customerId: customer.id,
          type: "remaining_balance",
          method: "zelle",
          amount: 200,
          reference: null,
          confirmationNumber: zelleConfNum,
        },
      ])
      .returning();
    for (const p of inserted) track.payment(p.id);

    // 1) No filters → contains all three of ours.
    const all = await api("/api/admin/payments", { headers: adminAuthHeader(admin) });
    assert.equal(all.status, 200);
    const ourIds = new Set(inserted.map((p) => p.id));
    const oursAll = (all.body as Array<{ id: number; method: string }>).filter((p) =>
      ourIds.has(p.id),
    );
    assert.equal(oursAll.length, 3);

    // 2) method=stripe → only stripe of ours.
    const stripeOnly = await api("/api/admin/payments?method=stripe", {
      headers: adminAuthHeader(admin),
    });
    assert.equal(stripeOnly.status, 200);
    interface AdminPaymentRow {
      id: number;
      method: string;
      confirmationNumber: string | null;
      paidAt: string | null;
      customer: { id: number; fullName: string; email: string } | null;
      job: { id: number; jobId: string } | null;
    }
    const oursStripe = (stripeOnly.body as AdminPaymentRow[]).filter((p) => ourIds.has(p.id));
    assert.equal(oursStripe.length, 1);
    assert.equal(oursStripe[0].method, "stripe");

    // 3) method=cash → only cash of ours.
    const cashOnly = await api("/api/admin/payments?method=cash", {
      headers: adminAuthHeader(admin),
    });
    const oursCash = (cashOnly.body as Array<{ id: number; method: string }>).filter((p) =>
      ourIds.has(p.id),
    );
    assert.equal(oursCash.length, 1);
    assert.equal(oursCash[0].method, "cash");

    // 4) method=all explicitly → same as no method filter.
    const allMethod = await api("/api/admin/payments?method=all", {
      headers: adminAuthHeader(admin),
    });
    const oursAllMethod = (allMethod.body as Array<{ id: number }>).filter((p) =>
      ourIds.has(p.id),
    );
    assert.equal(oursAllMethod.length, 3);

    // 5) search by full confirmation number → exactly one.
    const byConf = await api(
      `/api/admin/payments?search=${encodeURIComponent(stripeConfNum)}`,
      { headers: adminAuthHeader(admin) },
    );
    const matches = (byConf.body as Array<{ id: number; confirmationNumber: string }>).filter(
      (p) => p.confirmationNumber === stripeConfNum,
    );
    assert.equal(matches.length, 1);
    assert.equal(matches[0].id, inserted[0].id);

    // 6) search by customer name → all three of ours.
    const byName = await api(
      `/api/admin/payments?search=${encodeURIComponent(customer.fullName)}`,
      { headers: adminAuthHeader(admin) },
    );
    const oursByName = (byName.body as Array<{ id: number }>).filter((p) => ourIds.has(p.id));
    assert.equal(oursByName.length, 3);

    // 7) search that matches nothing → no matches from ours.
    const byNothing = await api(
      `/api/admin/payments?search=${encodeURIComponent("zzz-no-match-" + uniqueSuffix())}`,
      { headers: adminAuthHeader(admin) },
    );
    const oursNothing = (byNothing.body as Array<{ id: number }>).filter((p) => ourIds.has(p.id));
    assert.equal(oursNothing.length, 0);

    // 8) Returned payment shape includes joined customer + job + ISO paidAt.
    const stripeRow = oursStripe[0];
    assert.equal(stripeRow.customer?.id, customer.id);
    assert.equal(stripeRow.job?.id, jobId);
    if (stripeRow.paidAt != null) {
      assert.equal(typeof stripeRow.paidAt, "string");
      assert.ok(!Number.isNaN(Date.parse(stripeRow.paidAt)));
    }
  });
});

// ─── /api/admin/customers/lookup (used by the Send Payment Request modal) ───

describe("GET /api/admin/customers/lookup", () => {
  test("requires admin auth", async () => {
    const r = await api("/api/admin/customers/lookup?q=anything");
    assert.equal(r.status, 401);
  });

  test("returns [] when q is empty", async () => {
    const admin = await makeAdminUser();
    const r = await api("/api/admin/customers/lookup?q=", { headers: adminAuthHeader(admin) });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, []);
  });

  test("finds a customer by email + username + name and reports hasAccount", async () => {
    const admin = await makeAdminUser();
    const fullName = `LookupName${uniqueSuffix()}`;
    const customer = await createCustomerWithAccount({ fullName });

    const byEmail = await api(
      `/api/admin/customers/lookup?q=${encodeURIComponent(customer.email)}`,
      { headers: adminAuthHeader(admin) },
    );
    assert.equal(byEmail.status, 200);
    const eRow = (byEmail.body as Array<{ id: number; hasAccount: boolean }>).find(
      (r) => r.id === customer.id,
    );
    assert.ok(eRow, "expected customer to be found by email");
    assert.equal(eRow!.hasAccount, true);

    const byUsername = await api(
      `/api/admin/customers/lookup?q=${encodeURIComponent(customer.username!)}`,
      { headers: adminAuthHeader(admin) },
    );
    const uRow = (byUsername.body as Array<{ id: number }>).find((r) => r.id === customer.id);
    assert.ok(uRow, "expected customer to be found by +username");

    const byName = await api(
      `/api/admin/customers/lookup?q=${encodeURIComponent(fullName)}`,
      { headers: adminAuthHeader(admin) },
    );
    const nRow = (byName.body as Array<{ id: number }>).find((r) => r.id === customer.id);
    assert.ok(nRow, "expected customer to be found by name");
  });
});
