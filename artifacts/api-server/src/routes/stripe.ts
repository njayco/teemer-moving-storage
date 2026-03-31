import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { quoteRequestsTable, paymentsTable, revenueLedgerTable, jobsTable, invoicesTable } from "@workspace/db/schema";
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

interface FinalizeDepositParams {
  parsedQuoteId: number;
  stripeSessionId: string;
  logger: Request["log"];
}

async function finalizeDeposit({ parsedQuoteId, stripeSessionId, logger }: FinalizeDepositParams): Promise<{ updated: boolean; alreadyProcessed: boolean }> {
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
    const [existingJob] = await db.select().from(jobsTable)
      .where(eq(jobsTable.quoteId, parsedQuoteId)).limit(1);
    if (existingJob && stripeSessionId) {
      const [existingPayment] = await db.select().from(paymentsTable)
        .where(and(eq(paymentsTable.jobId, existingJob.id), eq(paymentsTable.reference, stripeSessionId)))
        .limit(1);
      if (!existingPayment) {
        const [quote] = await db.select().from(quoteRequestsTable)
          .where(eq(quoteRequestsTable.id, parsedQuoteId)).limit(1);
        const depositPaid = quote?.depositAmount ?? 50;
        await db.transaction(async (tx) => {
          await tx.insert(paymentsTable).values({
            jobId: existingJob.id,
            type: "deposit",
            method: "stripe",
            amount: depositPaid,
            reference: stripeSessionId,
            notes: `Stripe deposit for quote #${parsedQuoteId}`,
          });
          await tx.insert(revenueLedgerTable).values({
            jobId: existingJob.id,
            category: "deposit",
            amount: depositPaid,
          });
        });
        logger.info({ jobId: existingJob.id, amount: depositPaid }, "Late deposit payment recorded for already-processed quote");
      }
    }
    return { updated: false, alreadyProcessed: true };
  }

  logger.info({ quoteId: parsedQuoteId, sessionId: stripeSessionId }, "Quote marked deposit_paid");

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

  const [existingJob] = await db.select().from(jobsTable)
    .where(eq(jobsTable.quoteId, parsedQuoteId)).limit(1);
  if (existingJob) {
    const [existingPayment] = stripeSessionId
      ? await db.select().from(paymentsTable)
          .where(and(eq(paymentsTable.jobId, existingJob.id), eq(paymentsTable.reference, stripeSessionId)))
          .limit(1)
      : [undefined];
    if (!existingPayment) {
      await db.transaction(async (tx) => {
        await tx.insert(paymentsTable).values({
          jobId: existingJob.id,
          type: "deposit",
          method: "stripe",
          amount: depositPaid,
          reference: stripeSessionId,
          notes: `Stripe deposit for quote #${parsedQuoteId}`,
        });
        await tx.insert(revenueLedgerTable).values({
          jobId: existingJob.id,
          category: "deposit",
          amount: depositPaid,
        });
      });
      recordTimelineEvent({
        jobId: existingJob.id,
        eventType: "payment_recorded",
        statusLabel: "Deposit Payment Recorded",
        visibleToCustomer: true,
        notes: `Deposit of $${depositPaid.toFixed(2)} recorded via Stripe`,
      }).catch(() => {});
      logger.info({ jobId: existingJob.id, amount: depositPaid }, "Deposit payment and revenue ledger recorded");
    }
  }

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
  }).catch((err) => logger.error({ err }, "Failed to send deposit confirmation email"));

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
  }).catch((err) => logger.error({ err }, "Failed to send admin new job notification"));

  return { updated: true, alreadyProcessed: false };
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
      const result = await finalizeDeposit({
        parsedQuoteId,
        stripeSessionId: session.id,
        logger: req.log,
      });

      if (result.alreadyProcessed) {
        req.log.info({ quoteId }, "Quote already processed, webhook ensured side effects present");
      }

      const jobIdMeta = session.metadata?.jobId;
      const paymentType = session.metadata?.paymentType;
      if (paymentType === "balance_payment" && jobIdMeta) {
        const parsedJobId = parseInt(jobIdMeta, 10);
        if (!isNaN(parsedJobId)) {
          const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, parsedJobId)).limit(1);
          if (job && (job.status === "finished" || job.status === "awaiting_remaining_balance")) {
            const amountPaid = (session.amount_total ?? 0) / 100;
            await db.insert(paymentsTable).values({
              jobId: job.id,
              quoteId: job.quoteId,
              amount: amountPaid,
              method: "stripe",
              type: "remaining_balance",
              stripeSessionId: session.id,
            });
            await db.update(jobsTable).set({
              status: "complete",
              completedAt: new Date(),
              paymentStatus: "paid",
              remainingBalance: 0,
              updatedAt: new Date(),
            }).where(eq(jobsTable.id, job.id));
            const [existingInvoice] = await db.select().from(invoicesTable)
              .where(eq(invoicesTable.jobId, job.id)).limit(1);
            if (existingInvoice) {
              await db.update(invoicesTable).set({
                status: "paid",
                paidAt: new Date(),
                remainingBalanceDue: 0,
                updatedAt: new Date(),
              }).where(eq(invoicesTable.id, existingInvoice.id));
            }
            req.log.info({ jobId: job.id, amount: amountPaid }, "Balance payment received via Stripe — job auto-completed");
          }
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    req.log.error({ err }, "Stripe webhook processing failed");
    res.status(400).json({ error: "Webhook processing failed" });
  }
});

router.post("/stripe/verify-session", async (req: Request, res: Response) => {
  try {
    const { sessionId, quoteId } = req.body as { sessionId?: string; quoteId?: string };
    if (!sessionId || !quoteId) {
      return res.status(400).json({ error: "sessionId and quoteId are required" });
    }

    const parsedQuoteId = parseInt(quoteId, 10);
    if (isNaN(parsedQuoteId)) {
      return res.status(400).json({ error: "Invalid quoteId" });
    }

    const [quote] = await db.select().from(quoteRequestsTable)
      .where(eq(quoteRequestsTable.id, parsedQuoteId)).limit(1);

    if (quote?.status === "deposit_paid" || quote?.status === "booked") {
      return res.json({ verified: true, status: quote.status });
    }

    const { getUncachableStripeClient } = await import("../lib/stripe-client.js");
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid" && session.metadata?.quoteId === quoteId) {
      const result = await finalizeDeposit({
        parsedQuoteId,
        stripeSessionId: sessionId,
        logger: req.log,
      });

      if (result.updated || result.alreadyProcessed) {
        return res.json({ verified: true, status: "deposit_paid" });
      }
    }

    return res.json({ verified: false, status: quote?.status ?? "pending" });
  } catch (err) {
    req.log.error({ err }, "Session verification failed");
    return res.status(500).json({ error: "Verification failed" });
  }
});

router.post("/stripe/resend-deposit-emails", async (req: Request, res: Response) => {
  try {
    const { quoteId } = req.body as { quoteId?: string };
    if (!quoteId) return res.status(400).json({ error: "quoteId required" });

    const parsedQuoteId = parseInt(quoteId, 10);
    const [quote] = await db.select().from(quoteRequestsTable)
      .where(eq(quoteRequestsTable.id, parsedQuoteId)).limit(1);
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const depositPaid = quote.depositAmount ?? 50;
    const totalEstimate = quote.totalEstimate ?? 0;
    const remainingBalance = totalEstimate - depositPaid;
    const inventoryObj = (quote.inventory as Record<string, number>) || {};
    const inventoryItems = Object.entries(inventoryObj);
    const inventorySummary = inventoryItems.length > 0
      ? inventoryItems.map(([item, qty]) => `${item} (${qty})`).join(", ")
      : "No specific items listed";
    const boxesSummary = `Small: ${quote.smallBoxes ?? 0}, Medium: ${quote.mediumBoxes ?? 0}`;

    const baseUrl = getAppBaseUrl();
    const trackingUrl = `${baseUrl}/track/${parsedQuoteId}/${quote.trackingToken ?? ""}`;

    const customerResult = await sendDepositConfirmationEmail({
      customerName: quote.contactName ?? "Customer",
      email: quote.email ?? "",
      quoteId: parsedQuoteId,
      moveDate: quote.moveDate ?? "TBD",
      arrivalWindow: quote.arrivalTimeWindow ?? undefined,
      pickupAddress: quote.pickupAddress || quote.originAddress || "",
      dropoffAddress: quote.dropoffAddress || quote.destinationAddress || "",
      secondStop: quote.secondStop ?? undefined,
      inventorySummary,
      boxesSummary,
      crewSize: quote.crewSize ?? undefined,
      estimatedHours: quote.estimatedHours ?? undefined,
      totalEstimate,
      depositPaid,
      remainingBalance,
      trackingUrl,
    });

    const adminResult = await sendAdminNewJobNotification({
      quoteId: parsedQuoteId,
      customerName: quote.contactName ?? "Customer",
      customerEmail: quote.email ?? "",
      customerPhone: quote.phone ?? "",
      moveDate: quote.moveDate ?? "TBD",
      pickupAddress: quote.pickupAddress || quote.originAddress || "",
      dropoffAddress: quote.dropoffAddress || quote.destinationAddress || "",
      totalEstimate,
      depositPaid,
    });

    req.log.info({ quoteId: parsedQuoteId, customerResult, adminResult }, "Deposit emails resent");
    res.json({ success: true, customerResult, adminResult });
  } catch (err) {
    req.log.error({ err }, "Failed to resend deposit emails");
    res.status(500).json({ error: "Failed to resend emails" });
  }
});

export default router;
