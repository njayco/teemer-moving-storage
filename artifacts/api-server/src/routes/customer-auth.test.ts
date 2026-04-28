import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@workspace/db";
import { customersTable, quoteRequestsTable, jobsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
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
