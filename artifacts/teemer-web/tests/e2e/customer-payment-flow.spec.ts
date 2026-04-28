import { test, expect } from "@playwright/test";
import { uniqueTag, seedSavedQuoteCustomer, adminCreds } from "./lib/test-data";
import { simulatePaymentRequestPaid } from "./lib/stripe-webhook";

const apiBase = (): string => process.env.API_URL ?? "http://localhost:8080";

/**
 * Full customer-payment journey:
 *
 *   1. Save-for-later (the public quote page calls /api/customer-auth/signup
 *      with an attachQuoteId — this is exactly what "Save Quote" does).
 *   2. Customer logs in and sees the saved quote on their dashboard.
 *   3. Admin logs in, opens the Send Payment Request modal, picks the
 *      customer, enters an amount, and submits.
 *   4. Customer opens the pay page for that request.
 *   5. We simulate Stripe completing the checkout by signing and POST-ing a
 *      `checkout.session.completed` event to /api/stripe/webhook.
 *   6. The customer pay page (with `?paid=1` polling) flips to the
 *      success state and shows the TM-XXXXXXXXXX confirmation number.
 */
test("customer payment journey: save-for-later → admin payment request → self-pay → TM-XXXXXXXXXX", async ({ page, context }) => {
  const tag = uniqueTag();

  // ── 1. Save-for-later: create quote + customer via the same APIs the
  //      "Save Quote" modal calls. (Tested independently in api-server/src/
  //      routes/customer-auth.test.ts via the dedicated UI assertions.)
  const seed = await seedSavedQuoteCustomer(tag);
  expect(seed.username.startsWith("+")).toBe(true);

  // ── 2. Customer logs in via the real UI and sees the dashboard.
  await page.goto("/account/login");
  await page.getByLabel(/username|email/i).first().fill(seed.email);
  await page.getByLabel(/password/i).fill(seed.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/account(\?|$|\/)/, { timeout: 30_000 });
  await expect(page.getByText(seed.fullName, { exact: false })).toBeVisible({ timeout: 15_000 });

  // The saved quote should appear on the dashboard.
  await expect(page.getByText(/quote|estimate/i).first()).toBeVisible();

  // Drop the customer cookies so we can sign in as admin in this same browser.
  await context.clearCookies();

  // ── 3. Admin logs in and creates a payment request through the UI.
  const admin = adminCreds();
  await page.goto("/admin/login");
  await page.getByLabel(/email|username/i).first().fill(admin.email);
  await page.getByLabel(/password/i).fill(admin.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/admin(\?|$|\/)/, { timeout: 30_000 });

  // Open the Payments tab → "Send Payment Request" modal.
  const paymentsTab = page.getByRole("button", { name: /^payments$/i }).first();
  if (await paymentsTab.isVisible().catch(() => false)) {
    await paymentsTab.click();
  }
  await page.getByRole("button", { name: /send payment request/i }).first().click();

  // Search for our seeded customer.
  const search = page.getByPlaceholder(/search by name, email/i);
  await expect(search).toBeVisible();
  await search.fill(seed.email);
  // Wait for the lookup result button to appear and click it.
  const result = page.locator(`button:has-text("${seed.fullName}")`).first();
  await expect(result).toBeVisible({ timeout: 15_000 });
  await result.click();

  // Fill amount + description and submit.
  const amountDollars = 125;
  const amountCents = amountDollars * 100;
  await page.getByPlaceholder("250.00").fill(String(amountDollars));
  await page.getByPlaceholder(/final balance|overtime|extra crew/i).fill(`E2E payment request ${tag}`);
  await page.getByRole("button", { name: /^send request$/i }).click();
  await expect(page.getByText(/payment request sent/i)).toBeVisible({ timeout: 15_000 });

  // Read the freshly-created request id back via the admin API so we don't
  // have to scrape the success modal for it.
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const listRes = await fetch(`${apiBase()}/api/admin/payment-requests?status=pending`, {
    headers: { cookie: cookieHeader },
  });
  expect(listRes.ok).toBe(true);
  const listJson = (await listRes.json()) as Array<{ id: number; customerId: number; amountCents: number }>;
  const ourPr = listJson.find((p) => p.customerId === seed.customerId && p.amountCents === amountCents);
  expect(ourPr, "Could not find our newly-created payment request via admin API").toBeDefined();
  const paymentRequestId = ourPr!.id;

  // ── 4. Switch back to the customer and open the pay page.
  await context.clearCookies();
  await page.goto("/account/login");
  await page.getByLabel(/username|email/i).first().fill(seed.email);
  await page.getByLabel(/password/i).fill(seed.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/account(\?|$|\/)/, { timeout: 30_000 });

  await page.goto(`/account/payment-requests/${paymentRequestId}/pay`);
  await expect(page.getByText(`PR-${paymentRequestId}`)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /pay \$125\.00 with card/i })).toBeVisible();

  // ── 5. Simulate Stripe completing the checkout (we don't actually drive a
  //      hosted Stripe page; we sign the webhook directly so the test is
  //      hermetic and doesn't depend on stripe.com being reachable from CI).
  await simulatePaymentRequestPaid({
    apiBase: apiBase(),
    paymentRequestId,
    customerId: seed.customerId,
    amountCents,
  });

  // ── 6. Reload with ?paid=1 so the page enters its post-checkout polling
  //      loop and confirm the success state + TM-XXXXXXXXXX number.
  await page.goto(`/account/payment-requests/${paymentRequestId}/pay?paid=1`);
  await expect(page.getByText(/paid\s*[—-]\s*thank you/i)).toBeVisible({ timeout: 30_000 });
  const confirmationLine = page.getByText(/Confirmation #:/i);
  await expect(confirmationLine).toBeVisible({ timeout: 15_000 });
  await expect(confirmationLine).toHaveText(/TM-[A-Z0-9]{10}/);
});
