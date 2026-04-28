import { test, expect } from "@playwright/test";
import { uniqueTag, seedSavedQuoteCustomer, adminCreds } from "./lib/test-data";
import { simulateCustomerBalancePaid } from "./lib/stripe-webhook";

const apiBase = (): string => process.env.API_URL ?? "http://localhost:8080";

/**
 * Customer balance-payment journey (mirrors customer-payment-flow.spec.ts but
 * for `paymentType: "customer_balance_payment"` — the customer paying their
 * remaining job balance from the dashboard, not an admin-initiated payment
 * request):
 *
 *   1. Seed customer + saved quote (same helper as the sibling spec).
 *   2. Admin logs in and creates a booked job for that customer with a
 *      remaining balance via POST /api/jobs.
 *   3. Customer logs in, opens the job detail page, sees the
 *      "Pay Remaining $X" button.
 *   4. We simulate Stripe completing the customer-driven balance checkout
 *      by signing and POST-ing a `checkout.session.completed` event with
 *      `paymentType=customer_balance_payment` + `jobId` metadata.
 *   5. The job detail page (with `?paid=1` polling) flips to the success
 *      state and shows the TM-XXXXXXXXXX confirmation number on the
 *      "Payments on this Job" table.
 */
test("customer balance payment journey: admin books job → customer pays remaining → TM-XXXXXXXXXX", async ({ page, context }) => {
  const tag = uniqueTag();

  // ── 1. Seed the customer + saved quote so the customer has a real login.
  const seed = await seedSavedQuoteCustomer(tag);

  // ── 2. Admin logs in via the UI and creates a booked job for this
  //      customer with an outstanding balance. We POST /api/jobs directly
  //      using the admin's session cookies (the admin "Create Job" flow
  //      hits the same endpoint).
  const admin = adminCreds();
  await page.goto("/admin/login");
  await page.getByLabel(/email|username/i).first().fill(admin.email);
  await page.getByLabel(/password/i).fill(admin.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/admin(\?|$|\/)/, { timeout: 30_000 });

  const adminCookies = await context.cookies();
  const adminCookieHeader = adminCookies.map((c) => `${c.name}=${c.value}`).join("; ");

  const finalTotal = 1500;
  const depositPaid = 200;
  const remainingBalance = finalTotal - depositPaid;
  const remainingCents = remainingBalance * 100;

  const createJobRes = await fetch(`${apiBase()}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: adminCookieHeader },
    body: JSON.stringify({
      customer: seed.fullName,
      pickupLocation: "123 A St, Pittsburgh PA",
      destination: "456 B Ave, Pittsburgh PA",
      moveType: "local",
      dateTime: "2099-06-15T09:00",
      estimatedPayout: finalTotal,
      quoteId: seed.quoteId,
      customerId: seed.customerId,
      finalTotal,
      depositPaid,
      remainingBalance,
      originAddress: "123 A St, Pittsburgh PA",
      destinationAddress: "456 B Ave, Pittsburgh PA",
      arrivalWindow: "9:00 AM - 11:00 AM",
    }),
  });
  expect(createJobRes.ok, `POST /api/jobs failed: ${createJobRes.status} ${await createJobRes.text().catch(() => "")}`).toBe(true);
  const createdJob = (await createJobRes.json()) as { id: number };
  expect(createdJob.id, "Created job missing id").toBeTruthy();
  const jobId = createdJob.id;

  // Drop admin cookies so we can sign in as the customer in this same browser.
  await context.clearCookies();

  // ── 3. Customer logs in via the real UI and opens the job detail page.
  await page.goto("/account/login");
  await page.getByLabel(/username|email/i).first().fill(seed.email);
  await page.getByLabel(/password/i).fill(seed.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/account(\?|$|\/)/, { timeout: 30_000 });

  await page.goto(`/account/jobs/${jobId}`);
  await expect(page.getByText(`JOB-${jobId}`)).toBeVisible({ timeout: 15_000 });
  // The Pay Remaining button is the customer-balance-payment entry point.
  const payButton = page.getByRole("button", { name: /pay remaining \$1,300\.00/i });
  await expect(payButton).toBeVisible();

  // ── 4. Click "Pay Remaining" and intercept the resulting
  //      /balance-checkout call so we exercise the real button → mutation
  //      wiring without hitting Stripe. The interceptor:
  //        a) confirms the request was made (and tracks it),
  //        b) signs and POSTs the webhook to the API so the job is marked
  //           paid before the page navigates,
  //        c) returns a stub Stripe URL pointing back at the success page
  //           (relative URL, same as Stripe's success_url shape).
  let interceptedCheckoutPost = false;
  await page.route(`**/api/customer/jobs/${jobId}/balance-checkout`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    interceptedCheckoutPost = true;
    await simulateCustomerBalancePaid({
      apiBase: apiBase(),
      jobId,
      customerId: seed.customerId,
      amountCents: remainingCents,
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        url: `/account/jobs/${jobId}?paid=1&session_id=cs_test_intercepted`,
        sessionId: "cs_test_intercepted",
      }),
    });
  });

  await Promise.all([
    page.waitForURL(/\/account\/jobs\/\d+\?paid=1/, { timeout: 30_000 }),
    payButton.click(),
  ]);
  expect(interceptedCheckoutPost, "Pay Remaining button did not POST to /balance-checkout").toBe(true);

  // ── 5. Page is now on /account/jobs/{id}?paid=1 — assert the success
  //      banner, the zero remaining balance, and the TM-XXXXXXXXXX
  //      confirmation number on the payments table.
  await expect(page.getByText(/payment successful\s*[—-]\s*thank you/i)).toBeVisible({ timeout: 30_000 });

  // The "Pay Remaining" CTA disappears once the balance is zero.
  await expect(
    page.getByRole("button", { name: /pay remaining/i }),
  ).toHaveCount(0, { timeout: 15_000 });

  // The Payments table shows the new remaining_balance row with a
  // TM-XXXXXXXXXX confirmation number.
  const paymentsHeading = page.getByRole("heading", { name: /payments on this job/i });
  await expect(paymentsHeading).toBeVisible({ timeout: 15_000 });
  const confirmationCell = page.locator("td").filter({ hasText: /TM-[A-Z0-9]{10}/ }).first();
  await expect(confirmationCell).toBeVisible({ timeout: 15_000 });
  await expect(confirmationCell).toHaveText(/TM-[A-Z0-9]{10}/);
});
