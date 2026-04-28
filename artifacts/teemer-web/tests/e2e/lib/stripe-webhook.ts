import Stripe from "stripe";
import { randomBytes } from "node:crypto";

/**
 * Sign a synthetic `checkout.session.completed` event with the configured
 * STRIPE_WEBHOOK_SECRET and POST it to the API server's webhook endpoint.
 *
 * Shared by the payment-request and customer-balance-payment specs so both
 * exercise the real production webhook code path (insert into `payments`,
 * mark request/job paid, build the TM-XXXXXXXXXX confirmation number, send
 * receipt email) without depending on a real Stripe redirect or webhook
 * forwarding tunnel.
 */
async function postSignedCheckoutSession(opts: {
  apiBase: string;
  amountCents: number;
  metadata: Record<string, string>;
}): Promise<{ paymentIntentId: string; sessionId: string }> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is required to run the e2e payment-flow test. " +
        "It must match the value the API server is using.",
    );
  }

  const sessionId = `cs_test_e2e_${randomBytes(8).toString("hex")}`;
  const paymentIntentId = `pi_test_e2e_${randomBytes(8).toString("hex")}`;
  const eventId = `evt_test_e2e_${randomBytes(8).toString("hex")}`;
  const ts = Math.floor(Date.now() / 1000);

  const event = {
    id: eventId,
    object: "event",
    api_version: "2024-06-20",
    created: ts,
    livemode: false,
    pending_webhooks: 0,
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        livemode: false,
        payment_status: "paid",
        amount_total: opts.amountCents,
        currency: "usd",
        payment_intent: paymentIntentId,
        metadata: opts.metadata,
      },
    },
  };

  const payload = JSON.stringify(event);
  const stripe = new Stripe("sk_test_e2e_dummy", { apiVersion: "2024-06-20" as Stripe.LatestApiVersion });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: ts,
  });

  const res = await fetch(`${opts.apiBase}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });

  if (!res.ok) {
    throw new Error(
      `Simulated Stripe webhook rejected by server: ${res.status} ${await res.text()}`,
    );
  }
  return { paymentIntentId, sessionId };
}

/**
 * Build a synthetic `checkout.session.completed` event for a Teemer
 * payment-request and POST it to the API server's Stripe webhook endpoint
 * with a valid signature.
 */
export async function simulatePaymentRequestPaid(opts: {
  apiBase: string;
  paymentRequestId: number;
  customerId: number;
  amountCents: number;
}): Promise<{ paymentIntentId: string }> {
  const { paymentIntentId } = await postSignedCheckoutSession({
    apiBase: opts.apiBase,
    amountCents: opts.amountCents,
    metadata: {
      paymentType: "payment_request",
      paymentRequestId: String(opts.paymentRequestId),
      customerId: String(opts.customerId),
    },
  });
  return { paymentIntentId };
}

/**
 * Build a synthetic `checkout.session.completed` event for a customer
 * paying their remaining job balance from the dashboard
 * (`paymentType: "customer_balance_payment"`, see
 * artifacts/api-server/src/routes/stripe.ts).
 */
export async function simulateCustomerBalancePaid(opts: {
  apiBase: string;
  jobId: number;
  customerId: number;
  amountCents: number;
}): Promise<{ paymentIntentId: string }> {
  const { paymentIntentId } = await postSignedCheckoutSession({
    apiBase: opts.apiBase,
    amountCents: opts.amountCents,
    metadata: {
      paymentType: "customer_balance_payment",
      jobId: String(opts.jobId),
      customerJobId: String(opts.jobId),
      customerId: String(opts.customerId),
    },
  });
  return { paymentIntentId };
}
