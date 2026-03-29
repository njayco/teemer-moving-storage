import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { quoteRequestsTable } from "@workspace/db/schema";
import { eq, and, notInArray } from "drizzle-orm";
import crypto from "crypto";
import {
  sendDepositConfirmationEmail,
  sendAdminNewJobNotification,
} from "../lib/email-service";
import { recordTimelineEvent } from "../lib/timeline";

const router: IRouter = Router();

function getAppBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  const domain =
    process.env.REPLIT_DEPLOYMENT === "1"
      ? process.env.REPLIT_DOMAINS?.split(",")[0]
      : process.env.REPLIT_DEV_DOMAIN;
  return domain ? `https://${domain}` : "https://teemer.com";
}

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
      if (session.payment_status !== "paid") {
        req.log.info({ paymentStatus: session.payment_status }, "Checkout completed but payment not yet paid, skipping");
        res.json({ received: true });
        return;
      }

      const quoteId = session.metadata?.quoteId;
      if (!quoteId || isNaN(parseInt(quoteId, 10))) {
        req.log.error({ metadata: session.metadata }, "Invalid or missing quoteId in checkout session metadata");
        res.status(400).json({ error: "Invalid quoteId in session metadata" });
        return;
      }

      const parsedQuoteId = parseInt(quoteId, 10);

      const trackingToken = crypto.randomUUID();

      const [updatedQuote] = await db
        .update(quoteRequestsTable)
        .set({ status: "deposit_paid", trackingToken })
        .where(
          and(
            eq(quoteRequestsTable.id, parsedQuoteId),
            notInArray(quoteRequestsTable.status, ["deposit_paid", "booked"])
          )
        )
        .returning();

      if (!updatedQuote) {
        req.log.info({ quoteId }, "Quote already processed or not found, skipping duplicate webhook");
        res.json({ received: true });
        return;
      }

      req.log.info({ quoteId, sessionId: session.id }, "Quote marked deposit_paid");

      recordTimelineEvent({
        jobId: parsedQuoteId,
        eventType: "deposit_paid",
        statusLabel: "Deposit Paid",
        visibleToCustomer: true,
        notes: `Deposit of $${(updatedQuote.depositAmount ?? 50).toFixed(2)} received via Stripe`,
      }).catch(() => {});

      const baseUrl = getAppBaseUrl();
      const trackingUrl = `${baseUrl}/track/${parsedQuoteId}/${trackingToken}`;
      const depositPaid = updatedQuote.depositAmount ?? 50;
      const totalEstimate = updatedQuote.totalEstimate ?? 0;
      const remainingBalance = totalEstimate - depositPaid;

      const inventoryObj = (updatedQuote.inventory as Record<string, number>) || {};
      const inventoryItems = Object.entries(inventoryObj);
      const inventorySummary =
        inventoryItems.length > 0
          ? inventoryItems.map(([item, qty]) => `${item} (${qty})`).join(", ")
          : "No specific items listed";
      const boxesSummary = `Small: ${updatedQuote.smallBoxes ?? 0}, Medium: ${updatedQuote.mediumBoxes ?? 0}`;

      sendDepositConfirmationEmail({
        customerName: updatedQuote.contactName ?? "Customer",
        email: updatedQuote.email ?? "",
        quoteId: parsedQuoteId,
        moveDate: updatedQuote.moveDate ?? "TBD",
        arrivalWindow: updatedQuote.arrivalTimeWindow ?? undefined,
        pickupAddress: updatedQuote.pickupAddress || updatedQuote.originAddress || "",
        dropoffAddress: updatedQuote.dropoffAddress || updatedQuote.destinationAddress || "",
        secondStop: updatedQuote.secondStop ?? undefined,
        inventorySummary,
        boxesSummary,
        crewSize: updatedQuote.crewSize ?? undefined,
        estimatedHours: updatedQuote.estimatedHours ?? undefined,
        totalEstimate,
        depositPaid,
        remainingBalance,
        trackingUrl,
      }).catch((err) => req.log.error({ err }, "Failed to send deposit confirmation email"));

      sendAdminNewJobNotification({
        quoteId: parsedQuoteId,
        customerName: updatedQuote.contactName ?? "Customer",
        customerEmail: updatedQuote.email ?? "",
        customerPhone: updatedQuote.phone ?? "",
        moveDate: updatedQuote.moveDate ?? "TBD",
        pickupAddress: updatedQuote.pickupAddress || updatedQuote.originAddress || "",
        dropoffAddress: updatedQuote.dropoffAddress || updatedQuote.destinationAddress || "",
        totalEstimate,
        depositPaid,
      }).catch((err) => req.log.error({ err }, "Failed to send admin new job notification"));
    }

    res.json({ received: true });
  } catch (err) {
    req.log.error({ err }, "Stripe webhook processing failed");
    res.status(400).json({ error: "Webhook processing failed" });
  }
});

export default router;
