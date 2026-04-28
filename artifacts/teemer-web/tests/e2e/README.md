# Teemer end-to-end tests

This directory contains the Playwright e2e suite covering both production
customer-payment paths:

**`customer-payment-flow.spec.ts` — admin-initiated payment request**

- Save-for-later signup attaches the in-flight quote to a brand-new customer.
- The customer logs in and sees the quote on their dashboard.
- An admin logs in and creates a payment request for that customer through
  the **Send Payment Request** modal.
- The customer opens the pay page and (via a signed Stripe webhook simulation)
  the request is marked paid with a `TM-XXXXXXXXXX` confirmation number.

**`customer-balance-payment.spec.ts` — customer self-pay of remaining balance**

- Same seeded customer + saved quote.
- An admin logs in and creates a booked job for the customer with an
  outstanding balance via `POST /api/jobs`.
- The customer logs in, opens the job detail page, sees the
  **Pay Remaining $X** button.
- A signed Stripe webhook with
  `paymentType: "customer_balance_payment"` is POSTed to the API server,
  driving the same code path Stripe would after a successful checkout.
- Reloading the job detail page with `?paid=1` flips it to the success
  state and shows the `TM-XXXXXXXXXX` confirmation number on the
  Payments table.

## Prerequisites

1. **API server + web app running.** Start the workflows in this Repl, or
   manually:
   ```bash
   pnpm --filter @workspace/api-server dev
   pnpm --filter @workspace/teemer-web dev
   ```
2. **Browsers installed** (one-time):
   ```bash
   pnpm --filter @workspace/teemer-web exec playwright install chromium
   ```
3. **Environment variables** (the test reads these):
   - `BASE_URL` — web app URL, default `http://localhost:25308`
   - `API_URL` — API server URL, default `http://localhost:8080`
   - `STRIPE_WEBHOOK_SECRET` — must match the value the API server is using;
     the test signs a synthetic `checkout.session.completed` event with this.
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` — admin credentials, default
     `alan@teemermoving.com` / `Teemer123!` (the seeded admin).

## Run

```bash
pnpm --filter @workspace/teemer-web test:e2e
```

The Stripe step is **hermetic**: we don't actually navigate to the hosted
Stripe checkout page. Instead, the test signs and POSTs a
`checkout.session.completed` event to `/api/stripe/webhook`, which is exactly
what Stripe would do after a successful payment. This keeps the test fast and
deterministic, while still exercising the real production webhook code path
(insert into `payments`, mark request paid, build the TM-XXXXXXXXXX
confirmation number, send the receipt email).
