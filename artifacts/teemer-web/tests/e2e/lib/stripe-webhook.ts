import Stripe from "stripe";
import { randomBytes } from "node:crypto";

/**
 * Build a synthetic `checkout.session.completed` event for a Teemer
 * payment-request and POST it to the API server's Stripe webhook endpoint
 * with a valid signature.
 *
 * This lets the e2e test exercise the entire post-payment code path
 * (insert into payments, mark request paid, build TM-XXXXXXXXXX, send
 * receipt) without depending on a real Stripe redirect or a webhook
 * forwarding tunnel.
 */
export async function simulatePaymentRequestPaid(opts: {
  apiBase: string;
  paymentRequestId: number;
  customerId: number;
  amountCents: number;
}): Promise<{ paymentIntentId: string }> {
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
        metadata: {
          paymentType: "payment_request",
          paymentRequestId: String(opts.paymentRequestId),
          customerId: String(opts.customerId),
        },
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
  return { paymentIntentId };
}
