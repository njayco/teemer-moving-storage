import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  quoteRequestsTable,
  paymentsTable,
  revenueLedgerTable,
  jobsTable,
  invoicesTable,
  discountCodesTable,
  paymentRequestsTable,
  customersTable,
} from "@workspace/db/schema";
import { eq, and, notInArray, isNull, sql } from "drizzle-orm";
import crypto from "crypto";
import {
  sendDepositConfirmationEmail,
  sendAdminNewJobNotification,
  sendPaymentReceiptEmail,
} from "../lib/email-service";
import { recordTimelineEvent } from "../lib/timeline";
import { getEffectiveMountedTVFee } from "../lib/pricing-engine.js";
import { buildConfirmationNumber } from "../lib/auth";

const router: IRouter = Router();

// Atomically mark this quote's discount-code redemption as counted (only the
// first call returns true). Callers should only increment the code's
// `usageCount` when this returns true. This is the cross-path idempotency
// guard that prevents Stripe webhook retries — or rare multiple-session
// flows on the same quote — from over-counting redemptions.
async function tryClaimDiscountRedemption(quoteId: number): Promise<boolean> {
  const claimed = await db
    .update(quoteRequestsTable)
    .set({ discountRedeemedAt: new Date() })
    .where(and(eq(quoteRequestsTable.id, quoteId), isNull(quoteRequestsTable.discountRedeemedAt)))
    .returning({ id: quoteRequestsTable.id });
  return claimed.length > 0;
}

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
  paymentIntentId?: string | null;
  logger: Request["log"];
}

async function finalizeDeposit({ parsedQuoteId, stripeSessionId, paymentIntentId, logger }: FinalizeDepositParams): Promise<{ updated: boolean; alreadyProcessed: boolean }> {
  const confirmationNumber = paymentIntentId ? buildConfirmationNumber(paymentIntentId) : null;
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
            customerId: existingJob.customerId ?? quote?.customerId ?? null,
            type: "deposit",
            method: "stripe",
            amount: depositPaid,
            reference: stripeSessionId,
            confirmationNumber,
            notes: `Stripe deposit for quote #${parsedQuoteId}`,
          });
          await tx.insert(revenueLedgerTable).values({
            jobId: existingJob.id,
            category: "deposit",
            amount: depositPaid,
          });
        });
        logger.info({ jobId: existingJob.id, amount: depositPaid, confirmationNumber }, "Late deposit payment recorded for already-processed quote");

        // Also count the discount-code redemption for this newly-recorded
        // late payment, mirroring the main path below. The redemption-claim
        // marker on the quote makes this idempotent across retries and
        // multiple sessions; the conditional update on usageLimit keeps the
        // limit enforcement atomic against concurrent redemptions of *other*
        // quotes using the same code.
        if (quote?.discountCode) {
          try {
            const claimed = await tryClaimDiscountRedemption(parsedQuoteId);
            if (!claimed) {
              logger.info(
                { code: quote.discountCode, quoteId: parsedQuoteId },
                "Discount redemption already counted for this quote; skipping increment",
              );
            } else {
              const incremented = await db
                .update(discountCodesTable)
                .set({ usageCount: sql`${discountCodesTable.usageCount} + 1` })
                .where(
                  and(
                    eq(discountCodesTable.code, quote.discountCode),
                    sql`(${discountCodesTable.usageLimit} IS NULL OR ${discountCodesTable.usageCount} < ${discountCodesTable.usageLimit})`,
                  ),
                )
                .returning({ id: discountCodesTable.id });
              if (incremented.length === 0) {
                logger.warn(
                  { code: quote.discountCode, quoteId: parsedQuoteId },
                  "Discount code already at usage limit at late-finalize time; not incrementing",
                );
              }
            }
          } catch (err) {
            logger.error({ err, code: quote.discountCode }, "Failed to increment discount code usageCount on late payment");
          }
        }
      }
    }
    return { updated: false, alreadyProcessed: true };
  }

  logger.info({ quoteId: parsedQuoteId, sessionId: stripeSessionId }, "Quote marked deposit_paid");

  // Now that the deposit is confirmed paid, count the discount-code redemption.
  // We do this here (not in /quotes/:id/checkout) so abandoned/failed Stripe
  // sessions do not consume the code's usageLimit.
  // Conditional update guards against the usage-limit race window: only
  // increment when the code is still under its limit. This is one atomic
  // SQL statement, so concurrent webhooks cannot push past `usageLimit`.
  if (updatedQuote.discountCode) {
    try {
      const claimed = await tryClaimDiscountRedemption(parsedQuoteId);
      if (!claimed) {
        logger.info(
          { code: updatedQuote.discountCode, quoteId: parsedQuoteId },
          "Discount redemption already counted for this quote; skipping increment",
        );
      } else {
        const incremented = await db
          .update(discountCodesTable)
          .set({ usageCount: sql`${discountCodesTable.usageCount} + 1` })
          .where(
            and(
              eq(discountCodesTable.code, updatedQuote.discountCode),
              sql`(${discountCodesTable.usageLimit} IS NULL OR ${discountCodesTable.usageCount} < ${discountCodesTable.usageLimit})`,
            ),
          )
          .returning({ id: discountCodesTable.id });
        if (incremented.length === 0) {
          logger.warn(
            { code: updatedQuote.discountCode, quoteId: parsedQuoteId },
            "Discount code already at usage limit at deposit-finalize time; not incrementing",
          );
        }
      }
    } catch (err) {
      logger.error({ err, code: updatedQuote.discountCode }, "Failed to increment discount code usageCount after deposit");
    }
  }

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
          customerId: existingJob.customerId ?? updatedQuote.customerId ?? null,
          type: "deposit",
          method: "stripe",
          amount: depositPaid,
          reference: stripeSessionId,
          confirmationNumber,
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
      logger.info({ jobId: existingJob.id, amount: depositPaid, confirmationNumber }, "Deposit payment and revenue ledger recorded");
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
    // Task #43: propagate booking details so the customer's confirmation
    // email mirrors what they entered in the wizard.
    packingDate: updatedQuote.packingDate ?? null,
    packingArrivalWindow: updatedQuote.packingArrivalWindow ?? null,
    hasMountedTVs: Boolean(updatedQuote.hasMountedTVs),
    mountedTVCount: updatedQuote.mountedTVCount ?? 0,
    mountedTVFee: getEffectiveMountedTVFee({
      hasMountedTVs: updatedQuote.hasMountedTVs,
      storedFee: updatedQuote.mountedTVFee,
    }),
    parkingInstructions: updatedQuote.parkingInstructions ?? null,
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

      const paymentType = session.metadata?.paymentType;

      if (paymentType === "balance_payment" || paymentType === "customer_balance_payment") {
        const jobIdMeta = session.metadata?.jobId ?? session.metadata?.customerJobId;
        if (!jobIdMeta || isNaN(parseInt(jobIdMeta, 10))) {
          req.log.error({ metadata: session.metadata }, "Balance payment webhook missing valid jobId");
          res.json({ received: true });
          return;
        }
        const parsedJobId = parseInt(jobIdMeta, 10);
        const customerIdMeta = session.metadata?.customerId
          ? parseInt(session.metadata.customerId, 10)
          : null;
        const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, parsedJobId)).limit(1);
        const isCustomerSelfPay = paymentType === "customer_balance_payment";
        if (
          job &&
          (isCustomerSelfPay ||
            job.status === "finished" ||
            job.status === "awaiting_remaining_balance")
        ) {
          const existingPayment = await db
            .select()
            .from(paymentsTable)
            .where(and(eq(paymentsTable.jobId, job.id), eq(paymentsTable.reference, session.id)))
            .limit(1);
          if (existingPayment.length === 0) {
            const amountPaid = (session.amount_total ?? 0) / 100;
            // Resolve confirmation number from PaymentIntent
            let confirmationNumber: string | null = null;
            try {
              const piId =
                typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
              if (piId) confirmationNumber = buildConfirmationNumber(piId);
            } catch {
              /* ignore */
            }

            await db.transaction(async (tx) => {
              await tx.insert(paymentsTable).values({
                jobId: job.id,
                customerId: customerIdMeta && Number.isFinite(customerIdMeta) ? customerIdMeta : null,
                amount: amountPaid,
                method: "stripe",
                type: "remaining_balance",
                reference: session.id,
                confirmationNumber,
              });
              const newStatus =
                job.status === "finished" || job.status === "awaiting_remaining_balance"
                  ? "complete"
                  : job.status;
              await tx
                .update(jobsTable)
                .set({
                  status: newStatus,
                  completedAt: newStatus === "complete" ? new Date() : job.completedAt,
                  paymentStatus: "paid",
                  remainingBalance: 0,
                  updatedAt: new Date(),
                })
                .where(eq(jobsTable.id, job.id));
              const [existingInvoice] = await tx
                .select()
                .from(invoicesTable)
                .where(eq(invoicesTable.jobId, job.id))
                .limit(1);
              if (existingInvoice) {
                await tx
                  .update(invoicesTable)
                  .set({
                    status: "paid",
                    paidAt: new Date(),
                    remainingBalanceDue: 0,
                    updatedAt: new Date(),
                  })
                  .where(eq(invoicesTable.id, existingInvoice.id));
              }
            });
            req.log.info(
              { jobId: job.id, amount: amountPaid, confirmationNumber },
              "Balance payment received via Stripe — job auto-completed",
            );
            // Send receipt email (best-effort)
            try {
              const [q] = job.quoteId
                ? await db
                    .select({
                      contactName: quoteRequestsTable.contactName,
                      email: quoteRequestsTable.email,
                    })
                    .from(quoteRequestsTable)
                    .where(eq(quoteRequestsTable.id, job.quoteId))
                    .limit(1)
                : [];
              const customerEmailLookup = customerIdMeta
                ? (
                    await db
                      .select({ email: customersTable.email, fullName: customersTable.fullName })
                      .from(customersTable)
                      .where(eq(customersTable.id, customerIdMeta))
                      .limit(1)
                  )[0]
                : undefined;
              const recipientEmail = q?.email ?? customerEmailLookup?.email;
              const recipientName = q?.contactName ?? customerEmailLookup?.fullName ?? "Customer";
              if (recipientEmail && confirmationNumber) {
                sendPaymentReceiptEmail({
                  email: recipientEmail,
                  customerName: recipientName,
                  amount: amountPaid,
                  confirmationNumber,
                  description: `Remaining balance for Job #${job.id}`,
                  paidAt: new Date().toLocaleString(),
                  jobId: String(job.id),
                }).catch((err) => req.log.error({ err }, "Failed to send payment receipt email"));
              }
            } catch (err) {
              req.log.error({ err }, "Failed to fetch info for receipt email");
            }
          } else {
            req.log.info({ jobId: job.id }, "Balance payment already processed for this session");
          }
        }
      } else if (paymentType === "payment_request") {
        const prIdMeta = session.metadata?.paymentRequestId;
        const customerIdMeta = session.metadata?.customerId
          ? parseInt(session.metadata.customerId, 10)
          : null;
        if (!prIdMeta || isNaN(parseInt(prIdMeta, 10))) {
          req.log.error({ metadata: session.metadata }, "Payment-request webhook missing valid id");
          res.json({ received: true });
          return;
        }
        const prId = parseInt(prIdMeta, 10);
        const [pr] = await db
          .select()
          .from(paymentRequestsTable)
          .where(eq(paymentRequestsTable.id, prId))
          .limit(1);
        if (pr && pr.status !== "paid") {
          const existingPayment = await db
            .select()
            .from(paymentsTable)
            .where(
              and(eq(paymentsTable.paymentRequestId, pr.id), eq(paymentsTable.reference, session.id)),
            )
            .limit(1);
          if (existingPayment.length === 0) {
            const amountPaid = (session.amount_total ?? 0) / 100;
            let confirmationNumber: string | null = null;
            try {
              const piId =
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent?.id;
              if (piId) confirmationNumber = buildConfirmationNumber(piId);
            } catch {
              /* ignore */
            }

            await db.transaction(async (tx) => {
              await tx.insert(paymentsTable).values({
                jobId: null,
                customerId: pr.customerId,
                paymentRequestId: pr.id,
                amount: amountPaid,
                method: "stripe",
                type: "payment_request",
                reference: session.id,
                confirmationNumber,
                notes: pr.description,
              });
              await tx
                .update(paymentRequestsTable)
                .set({
                  status: "paid",
                  paidAt: new Date(),
                  stripeSessionId: session.id,
                  stripePaymentIntentId:
                    typeof session.payment_intent === "string"
                      ? session.payment_intent
                      : session.payment_intent?.id ?? null,
                  confirmationNumber,
                  updatedAt: new Date(),
                })
                .where(eq(paymentRequestsTable.id, pr.id));
            });
            // Send receipt
            try {
              const [c] = await db
                .select({ email: customersTable.email, fullName: customersTable.fullName })
                .from(customersTable)
                .where(eq(customersTable.id, pr.customerId))
                .limit(1);
              if (c?.email && confirmationNumber) {
                sendPaymentReceiptEmail({
                  email: c.email,
                  customerName: c.fullName,
                  amount: amountPaid,
                  confirmationNumber,
                  description: pr.description,
                  paidAt: new Date().toLocaleString(),
                  paymentRequestId: pr.id,
                }).catch((err) => req.log.error({ err }, "Failed to send PR receipt email"));
              }
            } catch (err) {
              req.log.error({ err }, "Failed to send payment-request receipt email");
            }
            req.log.info({ paymentRequestId: pr.id, confirmationNumber }, "Payment request paid via Stripe");
          }
        }
      } else {
        const quoteId = session.metadata?.quoteId;
        if (!quoteId || isNaN(parseInt(quoteId, 10))) {
          req.log.error({ metadata: session.metadata }, "Invalid or missing quoteId in checkout session metadata");
          res.status(400).json({ error: "Invalid quoteId in session metadata" });
          return;
        }

        const parsedQuoteId = parseInt(quoteId, 10);
        const depositPaymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null;
        const result = await finalizeDeposit({
          parsedQuoteId,
          stripeSessionId: session.id,
          paymentIntentId: depositPaymentIntentId,
          logger: req.log,
        });

        if (result.alreadyProcessed) {
          req.log.info({ quoteId }, "Quote already processed, webhook ensured side effects present");
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
      const verifyPaymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
      const result = await finalizeDeposit({
        parsedQuoteId,
        stripeSessionId: sessionId,
        paymentIntentId: verifyPaymentIntentId,
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
      // Task #43: include booking details on resend so manual re-sends match
      // what the customer entered.
      packingDate: quote.packingDate ?? null,
      packingArrivalWindow: quote.packingArrivalWindow ?? null,
      hasMountedTVs: Boolean(quote.hasMountedTVs),
      mountedTVCount: quote.mountedTVCount ?? 0,
      mountedTVFee: getEffectiveMountedTVFee({
        hasMountedTVs: quote.hasMountedTVs,
        storedFee: quote.mountedTVFee,
      }),
      parkingInstructions: quote.parkingInstructions ?? null,
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
