import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { quoteRequestsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/stripe/webhook", async (req: Request, res: Response) => {
  try {
    const { getUncachableStripeClient } = await import("../lib/stripe-client.js");

    const signature = req.headers["stripe-signature"] as string;
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      req.log.error("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const event = stripe.webhooks.constructEvent(req.body as Buffer, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const quoteId = session.metadata?.quoteId;
      if (!quoteId || isNaN(parseInt(quoteId, 10))) {
        req.log.error({ metadata: session.metadata }, "Invalid or missing quoteId in checkout session metadata");
        res.status(400).json({ error: "Invalid quoteId in session metadata" });
        return;
      }

      await db
        .update(quoteRequestsTable)
        .set({ status: "deposit_paid" })
        .where(eq(quoteRequestsTable.id, parseInt(quoteId, 10)));
      req.log.info({ quoteId, sessionId: session.id }, "Quote marked deposit_paid");
    }

    res.json({ received: true });
  } catch (err) {
    req.log.error({ err }, "Stripe webhook processing failed");
    res.status(400).json({ error: "Webhook processing failed" });
  }
});

export default router;
