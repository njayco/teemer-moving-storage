import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";

/**
 * Build a unique tag for this test run. We use this to namespace every
 * customer email/username/quote/etc the test creates so multiple runs
 * (or parallel CI shards) never collide on the unique-username index.
 */
export function uniqueTag(): string {
  return `e2e${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
}

export interface CustomerSeed {
  fullName: string;
  email: string;
  quoteId: number;
  customerId: number;
  username: string;
  password: string;
}

const SEED_PASSWORD = "TeemerSeed!23";

function seedUsername(tag: string): string {
  // Username rules: at least 2 chars, [A-Za-z0-9_.], no trailing dot.
  // The tag (uniqueTag) returns lowercase letters and digits, perfect.
  return `e2e.${tag}`;
}

const apiBase = (): string => process.env.API_URL ?? "http://localhost:8080";

/**
 * Forward all `/api/**` requests the page makes to the API server. The
 * teemer-web Vite dev server doesn't proxy `/api`, so without this any
 * fetch the React app makes (e.g. quote submission, save-for-later signup)
 * 404s when the test drives the live UI. Production deploys are reached
 * through the path-based proxy and don't need this.
 */
export async function routeApiToServer(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const original = route.request();
    const incoming = new URL(original.url());
    const target = `${apiBase()}${incoming.pathname}${incoming.search}`;

    const headers: Record<string, string> = { ...original.headers() };
    delete headers.host;
    delete headers[":authority"];

    const method = original.method();
    const hasBody = method !== "GET" && method !== "HEAD";

    let response: Response;
    try {
      response = await fetch(target, {
        method,
        headers,
        body: hasBody ? (original.postData() ?? undefined) : undefined,
        redirect: "manual",
      });
    } catch (err) {
      await route.abort("failed");
      throw err;
    }

    const respHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      // `content-encoding` lies once we've already decoded the body; drop it.
      if (key.toLowerCase() === "content-encoding") return;
      if (key.toLowerCase() === "content-length") return;
      respHeaders[key] = value;
    });

    const buf = Buffer.from(await response.arrayBuffer());
    await route.fulfill({
      status: response.status,
      headers: respHeaders,
      body: buf,
    });
  });
}

/**
 * Seed a customer who already has a password (so a second `/customer-auth/
 * signup` for the same email returns the 409 "Please sign in instead"
 * error). Unlike `seedSavedQuoteCustomer`, this does NOT create a quote —
 * use it when the test will create the quote itself through the UI.
 */
export async function seedCustomerWithPassword(
  tag: string,
): Promise<{ fullName: string; email: string; password: string }> {
  const fullName = `Existing Customer ${tag}`;
  const email = `existing+${tag}@teemer-tests.local`;
  const username = seedUsername(`existing${tag}`);
  const res = await fetch(`${apiBase()}/api/customer-auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName,
      email,
      username,
      password: SEED_PASSWORD,
      confirmPassword: SEED_PASSWORD,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to seed customer: ${res.status} ${await res.text()}`,
    );
  }
  return { fullName, email, password: SEED_PASSWORD };
}

/**
 * Seed a customer + quote via the public APIs so the UI flow has something
 * to work with. Returns everything the test needs to log in as the
 * customer or as an admin acting on this customer.
 */
export async function seedSavedQuoteCustomer(tag: string): Promise<CustomerSeed> {
  const fullName = `E2E Customer ${tag}`;
  const email = `e2e+${tag}@teemer-tests.local`;

  // 1) Create a quote owned by no-one (the Save-for-later flow attaches it).
  const quoteRes = await fetch(`${apiBase()}/api/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contactName: fullName,
      email,
      phone: "555-555-1212",
      moveDate: "2099-06-15",
      moveType: "local",
      originAddress: "123 A St, Pittsburgh PA",
      destinationAddress: "456 B Ave, Pittsburgh PA",
      pickupAddress: "123 A St, Pittsburgh PA",
      dropoffAddress: "456 B Ave, Pittsburgh PA",
      numberOfBedrooms: 1,
      numberOfLivingRooms: 1,
      isFullyFurnished: true,
      // The API now requires a pre-pack-day arrival window whenever the
      // computed packing time is >= 5 hours (which fully-furnished moves
      // hit). Match what the public quote form sends from
      // PACKING_ARRIVAL_WINDOWS[0] so this seed matches a real submission.
      packingArrivalWindow: "8:00 AM – 10:00 AM",
    }),
  });
  if (!quoteRes.ok) {
    throw new Error(`Failed to create quote: ${quoteRes.status} ${await quoteRes.text()}`);
  }
  const quote = await quoteRes.json();
  const quoteId: number = quote.id ?? quote.quoteId ?? quote.data?.id;
  if (!quoteId) throw new Error(`Quote response missing id: ${JSON.stringify(quote)}`);

  // 2) Sign up via Save-for-later, attaching the quote.
  const username = seedUsername(tag);
  const signupRes = await fetch(`${apiBase()}/api/customer-auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName,
      email,
      username,
      password: SEED_PASSWORD,
      confirmPassword: SEED_PASSWORD,
      attachQuoteId: quoteId,
    }),
  });
  if (!signupRes.ok) {
    throw new Error(`Failed to sign up: ${signupRes.status} ${await signupRes.text()}`);
  }
  const signup = await signupRes.json();

  return {
    fullName,
    email,
    quoteId,
    customerId: signup.customer.customerId,
    username: signup.customer.username,
    password: SEED_PASSWORD,
  };
}

export interface AdminCreds {
  email: string;
  password: string;
}

/**
 * Default seeded admin from `seed-admin.ts`. Override via env if your
 * environment uses different credentials.
 */
export function adminCreds(): AdminCreds {
  return {
    email: process.env.ADMIN_EMAIL ?? "alan@teemermoving.com",
    password: process.env.ADMIN_PASSWORD ?? "Teemer123!",
  };
}
