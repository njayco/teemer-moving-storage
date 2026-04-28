import { test, expect, type Page } from "@playwright/test";
import {
  routeApiToServer,
  seedCustomerWithPassword,
  uniqueTag,
} from "./lib/test-data";

/**
 * Focused UI coverage for the "Save Your Quote" modal
 * (`SaveForLaterModal` in `src/pages/info/quote.tsx`).
 *
 * The full payment-flow spec drives the Save-for-later step via the
 * `/api/customer-auth/signup` endpoint directly to keep that test fast,
 * which means the actual modal — its form, its 409 "sign in" fallback,
 * and its post-save redirect to `/account/quotes/:id` — was never
 * exercised by an automated test. This spec covers exactly that.
 *
 * To get to the modal we need a `quoteResult` to be set on the public
 * quote page, which only happens after submitting the multi-step form.
 * We use the **junk removal** flow because it is the shortest path
 * (only step 1 contact info + step 2 load size, no addresses, home size,
 * inventory, or boxes), keeping the test fast and stable.
 */

interface ContactDetails {
  name: string;
  phone: string;
  email: string;
  moveDate: string; // YYYY-MM-DD
}

/**
 * Drive the public quote form (junk removal path) until the
 * `QuoteResultsScreen` is rendered. This is the screen that hosts the
 * "Save this quote for later" entry point into the modal under test.
 */
async function driveFormToResults(page: Page, contact: ContactDetails) {
  await page.goto("/info/quote");

  // ── Step 1: choose Junk Removal (so we skip pickup/dropoff addresses
  //    and home-size/inventory/boxes steps), fill contact info, advance.
  await page.getByRole("button", { name: /^junk removal$/i }).click();
  await page.getByPlaceholder("Jane Smith").fill(contact.name);
  await page.getByPlaceholder("(516) 555-0100").fill(contact.phone);
  await page.getByPlaceholder("jane@example.com").fill(contact.email);
  await page.locator('input[type="date"]').first().fill(contact.moveDate);
  await page.getByRole("button", { name: /next:\s*load size/i }).click();

  // ── Step 2: defaults (small load, no add-ons) are fine. Submit.
  await page
    .getByRole("button", { name: /get my junk removal quote/i })
    .click();

  // The QuoteResultsScreen renders the "Quote #: X" footer once the
  // server responds with the priced quote.
  await expect(page.getByText(/Quote #:\s*\d+/)).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * Locate the open "Save Your Quote" modal so all field/button queries
 * are scoped to it (rather than to the underlying quote form).
 */
function modalOf(page: Page) {
  return page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: /save your quote/i }) })
    .last();
}

/**
 * The modal's inputs aren't `<label htmlFor>`-associated, so address
 * them by type (email/tel) and the leftover text input for full name.
 */
function modalInputs(page: Page) {
  const modal = modalOf(page);
  return {
    modal,
    fullName: modal.locator("input").nth(0),
    email: modal.locator('input[type="email"]'),
    username: modal.locator('input[autocomplete="username"]'),
    password: modal.locator('input[type="password"]').nth(0),
    confirmPassword: modal.locator('input[type="password"]').nth(1),
  };
}

test("save quote modal: new email creates account and redirects to /account/quotes/:id", async ({
  page,
}) => {
  await routeApiToServer(page);

  const tag = uniqueTag();
  const fullName = `Modal E2E ${tag}`;
  const email = `modal+${tag}@teemer-tests.local`;

  await driveFormToResults(page, {
    name: fullName,
    phone: "555-555-1212",
    email,
    moveDate: "2099-06-15",
  });

  // Open the Save Quote modal from the results screen.
  await page
    .getByRole("button", { name: /save this quote for later/i })
    .click();

  const {
    modal,
    fullName: nameInput,
    email: emailInput,
    username: usernameInput,
    password: passwordInput,
    confirmPassword: confirmInput,
  } = modalInputs(page);
  await expect(modal).toBeVisible();

  // Modal pre-fills name + email from step 1; re-fill explicitly so the
  // test asserts that those are the inputs that get submitted.
  await nameInput.fill(fullName);
  await emailInput.fill(email);
  // Username + password are now required (Task #71). Build a unique-ish
  // username so re-runs in the same DB don't collide on the unique index.
  await usernameInput.fill(`modal.${tag}`);
  await passwordInput.fill("ModalE2E!23");
  await confirmInput.fill("ModalE2E!23");

  // Submit. SaveForLaterModal navigates to /account/quotes/:id on success.
  await modal.getByRole("button", { name: /^save quote$/i }).click();

  await page.waitForURL(/\/account\/quotes\/\d+(\?|#|$)/, { timeout: 30_000 });
});

test("save quote modal: surfaces 'Sign in to your existing account' when the email already has a password", async ({
  page,
}) => {
  await routeApiToServer(page);

  const tag = uniqueTag();

  // Seed a customer whose email already has a password set. The signup
  // endpoint sets `passwordHash` on every successful call, so re-using
  // the same email is exactly what triggers the modal's 409 "sign in"
  // fallback. We deliberately do NOT seed a quote — the form will create
  // one for us, exercising the production code path end-to-end.
  const seed = await seedCustomerWithPassword(tag);

  await driveFormToResults(page, {
    name: `Different Name ${tag}`,
    phone: "555-555-1313",
    email: seed.email,
    moveDate: "2099-07-01",
  });

  await page
    .getByRole("button", { name: /save this quote for later/i })
    .click();

  const {
    modal,
    email: emailInput,
    username: usernameInput,
    password: passwordInput,
    confirmPassword: confirmInput,
  } = modalInputs(page);
  await expect(modal).toBeVisible();

  // The form is pre-filled from step 1, but assert it explicitly so the
  // test fails clearly if the prefill ever regresses.
  await expect(emailInput).toHaveValue(seed.email);

  // Required fields (Task #71). Use a fresh username so client-side
  // validation passes — we want the server-side 409 ("Please sign in
  // instead") to be what surfaces the sign-in fallback link.
  await usernameInput.fill(`existing.${tag}.attempt`);
  await passwordInput.fill("ModalE2E!23");
  await confirmInput.fill("ModalE2E!23");

  await modal.getByRole("button", { name: /^save quote$/i }).click();

  // The modal stays open and the sign-in fallback link appears.
  const signInLink = modal.getByRole("link", {
    name: /sign in to your existing account/i,
  });
  await expect(signInLink).toBeVisible({ timeout: 15_000 });

  // It points back at the customer login page with `next` set to the
  // newly-created quote id.
  const href = await signInLink.getAttribute("href");
  expect(href).toMatch(/^\/account\/login\?next=\/account\/quotes\/\d+$/);

  // We should NOT have been redirected to the dashboard.
  expect(page.url()).toContain("/info/quote");
});
