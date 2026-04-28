import { randomBytes } from "node:crypto";

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

const apiBase = (): string => process.env.API_URL ?? "http://localhost:8080";

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
    }),
  });
  if (!quoteRes.ok) {
    throw new Error(`Failed to create quote: ${quoteRes.status} ${await quoteRes.text()}`);
  }
  const quote = await quoteRes.json();
  const quoteId: number = quote.id ?? quote.quoteId ?? quote.data?.id;
  if (!quoteId) throw new Error(`Quote response missing id: ${JSON.stringify(quote)}`);

  // 2) Sign up via Save-for-later, attaching the quote.
  const signupRes = await fetch(`${apiBase()}/api/customer-auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName, email, attachQuoteId: quoteId }),
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
    password: signup.generatedPassword,
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
