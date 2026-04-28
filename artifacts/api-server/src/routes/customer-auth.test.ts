import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
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
