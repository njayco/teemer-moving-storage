import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { quoteRequestsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// POST /stripe/webhook  — Stripe webhook for payment events
// The raw body is provided by the express.raw() middleware in app.ts
router.post("/stripe/webhook", async (req: Request, res: Response) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    req.log.warn("Stripe webhook received but keys not configured");
    res.status(200).json({ received: true });
    return;
  }

  const signature = req.headers["stripe-signature"] as string;
  if (!signature) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event: import("stripe").Stripe.Event;
  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, webhookSecret);
  } catch (err) {
    req.log.error({ err }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Webhook signature verification failed" });
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as import("stripe").Stripe.Checkout.Session;
    const quoteId = session.metadata?.quoteId;
    if (quoteId) {
      try {
        await db
          .update(quoteRequestsTable)
          .set({ status: "deposit_paid" })
          .where(eq(quoteRequestsTable.id, parseInt(quoteId, 10)));
        req.log.info({ quoteId, sessionId: session.id }, "Quote marked deposit_paid");
      } catch (err) {
        req.log.error({ err, quoteId }, "Failed to update quote status after payment");
      }
    }
  }

  res.json({ received: true });
});

export default router;
