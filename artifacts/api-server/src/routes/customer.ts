import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  customersTable,
  quoteRequestsTable,
  jobsTable,
  invoicesTable,
  paymentsTable,
  paymentRequestsTable,
  contractsTable,
} from "@workspace/db/schema";
import { eq, sql, desc, and, isNull, inArray } from "drizzle-orm";
import { requireCustomer } from "../lib/auth";
import { generateContractPdf } from "../lib/contract-pdf";
import { generateInvoicePdf } from "../lib/invoice-pdf";
import { logger } from "../lib/logger";
import { attachQuoteToCustomer } from "./customer-auth";

const router: IRouter = Router();

function getAppBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  const domain =
    process.env.REPLIT_DEPLOYMENT === "1"
      ? process.env.REPLIT_DOMAINS?.split(",")[0]
      : process.env.REPLIT_DEV_DOMAIN;
  return domain ? `https://${domain}` : "https://teemermoving.com";
}

async function customerEmail(customerId: number): Promise<string | null> {
  const [c] = await db
    .select({ email: customersTable.email })
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);
  return c?.email?.toLowerCase() ?? null;
}

// ─── Saved quotes for the signed-in customer ────────────────────────────────

router.get("/customer/quotes", requireCustomer, async (req, res) => {
  const customerId = req.customer!.customerId;
  const rows = await db
    .select()
    .from(quoteRequestsTable)
    .where(eq(quoteRequestsTable.customerId, customerId))
    .orderBy(desc(quoteRequestsTable.createdAt));

  res.json(
    rows.map((q) => ({
      id: String(q.id),
      status: q.status ?? "quote_requested",
      contactName: q.contactName,
      moveDate: q.moveDate,
      pickupAddress: q.pickupAddress ?? q.originAddress ?? "",
      dropoffAddress: q.dropoffAddress ?? q.destinationAddress ?? "",
      totalEstimate: q.totalEstimate,
      depositAmount: q.depositAmount,
      crewSize: q.crewSize,
      estimatedHours: q.estimatedHours,
      createdAt: q.createdAt instanceof Date ? q.createdAt.toISOString() : q.createdAt,
    })),
  );
});

router.get("/customer/quotes/:id", requireCustomer, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid quote id" });
    return;
  }
  const customerId = req.customer!.customerId;
  const [quote] = await db.select().from(quoteRequestsTable).where(eq(quoteRequestsTable.id, id)).limit(1);
  if (!quote || quote.customerId !== customerId) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  res.json(quote);
});

router.patch("/customer/quotes/:id", requireCustomer, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid quote id" });
    return;
  }
  const customerId = req.customer!.customerId;
  const [quote] = await db.select().from(quoteRequestsTable).where(eq(quoteRequestsTable.id, id)).limit(1);
  if (!quote || quote.customerId !== customerId) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  if (quote.status && quote.status !== "quote_requested") {
    res.status(409).json({ error: "This quote can no longer be edited from your account. Please contact us." });
    return;
  }
  const editable: Partial<typeof quote> = {};
  const allowed = [
    "moveDate",
    "arrivalTimeWindow",
    "pickupAddress",
    "dropoffAddress",
    "secondStop",
    "additionalNotes",
    "parkingInstructions",
    "phone",
  ] as const;
  for (const key of allowed) {
    if (key in (req.body ?? {})) (editable as Record<string, unknown>)[key] = req.body[key];
  }
  if (Object.keys(editable).length === 0) {
    res.json(quote);
    return;
  }
  const [updated] = await db
    .update(quoteRequestsTable)
    .set(editable as Record<string, unknown>)
    .where(eq(quoteRequestsTable.id, id))
    .returning();
  res.json(updated);
});

/**
 * One-click "Save to my account" for an already-signed-in customer.
 * The quote's email must match the customer's email (ownership proof).
 */
router.post("/customer/quotes/:id/attach", requireCustomer, async (req, res) => {
  const quoteId = parseInt(String(req.params.id), 10);
  if (isNaN(quoteId)) {
    res.status(400).json({ error: "Invalid quote id" });
    return;
  }
  const customerId = req.customer!.customerId;
  const email = await customerEmail(customerId);
  if (!email) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const ok = await attachQuoteToCustomer({ quoteId, customerId, customerEmail: email });
  if (!ok) {
    res.status(409).json({
      error:
        "We couldn't link that quote to your account. The email on the quote must match your account email.",
    });
    return;
  }
  res.json({ success: true, quoteId });
});

// ─── Customer's jobs ────────────────────────────────────────────────────────

router.get("/customer/jobs", requireCustomer, async (req, res) => {
  const customerId = req.customer!.customerId;
  const jobs = await db
    .select()
    .from(jobsTable)
    .leftJoin(quoteRequestsTable, eq(jobsTable.quoteId, quoteRequestsTable.id))
    .where(eq(jobsTable.customerId, customerId))
    .orderBy(desc(jobsTable.createdAt));

  res.json(
    jobs.map(({ jobs: job, quote_requests: q }) => ({
      id: String(job.id),
      jobId: `JOB-${job.id}`,
      status: job.status,
      paymentStatus: job.paymentStatus,
      moveDate: q?.moveDate ?? null,
      arrivalWindow: job.arrivalWindow ?? q?.arrivalTimeWindow ?? null,
      pickupAddress: job.originAddress ?? q?.pickupAddress ?? "",
      dropoffAddress: job.destinationAddress ?? q?.dropoffAddress ?? "",
      finalTotal: job.finalTotal,
      depositPaid: job.depositPaid,
      remainingBalance: job.remainingBalance,
      crewSize: job.crewSize,
      estimatedHours: job.estimatedHours,
      hourlyRate: job.hourlyRate,
      createdAt: job.createdAt instanceof Date ? job.createdAt.toISOString() : job.createdAt,
      completedAt: job.completedAt instanceof Date ? job.completedAt.toISOString() : job.completedAt,
    })),
  );
});

async function loadOwnedJobAndQuote(jobId: number, customerId: number) {
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId)).limit(1);
  if (!job || job.customerId !== customerId) return { job: null as null, quote: null as null };
  let quote: typeof quoteRequestsTable.$inferSelect | null = null;
  if (job.quoteId) {
    const [q] = await db.select().from(quoteRequestsTable).where(eq(quoteRequestsTable.id, job.quoteId)).limit(1);
    quote = q ?? null;
  }
  return { job, quote };
}

router.get("/customer/jobs/:id", requireCustomer, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const { job, quote } = await loadOwnedJobAndQuote(id, req.customer!.customerId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.jobId, job.id)).limit(1);
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.jobId, job.id));
  res.json({
    job,
    quote,
    invoice: invoice ?? null,
    payments,
  });
});

// ─── Contract & invoice PDFs ────────────────────────────────────────────────

router.get("/customer/jobs/:id/contract.pdf", requireCustomer, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const { job, quote } = await loadOwnedJobAndQuote(id, req.customer!.customerId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.jobId, job.id)).limit(1);
  if (!contract) {
    res.status(404).json({ error: "No contract has been generated for this job yet." });
    return;
  }

  const pdf = await generateContractPdf({
    customerName: quote?.contactName ?? "Customer",
    customerPhone: quote?.phone ?? "",
    pickupAddress: quote?.pickupAddress ?? quote?.originAddress ?? "",
    dropoffAddress: quote?.dropoffAddress ?? quote?.destinationAddress ?? "",
    crewSize: job.crewSize ?? quote?.crewSize ?? undefined,
    estimatedHours: job.estimatedHours ?? quote?.estimatedHours ?? undefined,
    moveDate: quote?.moveDate ?? undefined,
    arrivalWindow: job.arrivalWindow ?? quote?.arrivalTimeWindow ?? undefined,
    inventory: (quote?.inventory as Record<string, number> | null) ?? undefined,
    additionalNotes: quote?.additionalNotes ?? undefined,
    jobId: `JOB-${job.id}`,
    quoteId: quote?.id,
    totalEstimate: job.finalTotal ?? quote?.totalEstimate ?? undefined,
    depositAmount: job.depositPaid ?? quote?.depositAmount ?? undefined,
    parkingInstructions: quote?.parkingInstructions ?? undefined,
    packingDate: quote?.packingDate ?? undefined,
    packingArrivalWindow: quote?.packingArrivalWindow ?? undefined,
    hasMountedTVs: Boolean(quote?.hasMountedTVs),
    mountedTVCount: quote?.mountedTVCount ?? 0,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="Teemer-Contract-${job.id}.pdf"`);
  res.send(pdf);
});

router.get("/customer/invoices/:jobId/pdf", requireCustomer, async (req, res) => {
  const jobId = parseInt(String(req.params.jobId), 10);
  if (isNaN(jobId)) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const { job, quote } = await loadOwnedJobAndQuote(jobId, req.customer!.customerId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.jobId, jobId)).limit(1);
  if (!invoice) {
    res.status(404).json({ error: "No invoice yet for this job." });
    return;
  }

  const paymentsForJob = await db.select().from(paymentsTable).where(eq(paymentsTable.jobId, jobId));
  const stripePayment = paymentsForJob.find((p) => p.confirmationNumber);
  const editable = invoice.editableSnapshotJson as { lineItems?: Array<{ name: string; quantity?: number; unitPrice?: number; total: number }> } | null;

  const pdf = await generateInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    customerName: quote?.contactName ?? "Customer",
    customerEmail: quote?.email ?? undefined,
    customerPhone: quote?.phone ?? undefined,
    jobId: `JOB-${job.id}`,
    moveDate: quote?.moveDate ?? undefined,
    pickupAddress: quote?.pickupAddress ?? quote?.originAddress ?? undefined,
    dropoffAddress: quote?.dropoffAddress ?? quote?.destinationAddress ?? undefined,
    lineItems: editable?.lineItems,
    subtotal: invoice.subtotal ?? 0,
    extraCharges: invoice.extraCharges ?? 0,
    discounts: invoice.discounts ?? 0,
    finalTotal: invoice.finalTotal ?? 0,
    depositApplied: invoice.depositApplied ?? 0,
    remainingBalanceDue: invoice.remainingBalanceDue ?? 0,
    status: invoice.status ?? undefined,
    paidAt: invoice.paidAt ? new Date(invoice.paidAt).toLocaleString() : null,
    confirmationNumber: stripePayment?.confirmationNumber ?? null,
    dueDate: invoice.dueDate ?? null,
    createdAt: invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : null,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="Teemer-Invoice-${invoice.invoiceNumber}.pdf"`);
  res.send(pdf);
});

// ─── Payment requests ───────────────────────────────────────────────────────

router.get("/customer/payment-requests", requireCustomer, async (req, res) => {
  const rows = await db
    .select()
    .from(paymentRequestsTable)
    .where(eq(paymentRequestsTable.customerId, req.customer!.customerId))
    .orderBy(desc(paymentRequestsTable.createdAt));
  res.json(rows);
});

router.get("/customer/payment-requests/:id", requireCustomer, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid request id" });
    return;
  }
  const [pr] = await db.select().from(paymentRequestsTable).where(eq(paymentRequestsTable.id, id)).limit(1);
  if (!pr || pr.customerId !== req.customer!.customerId) {
    res.status(404).json({ error: "Payment request not found" });
    return;
  }
  res.json(pr);
});

// ─── Payments history ───────────────────────────────────────────────────────

router.get("/customer/payments", requireCustomer, async (req, res) => {
  const customerId = req.customer!.customerId;

  // Owned jobs (linked by customer_id only — no email fallback).
  const customerJobs = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(eq(jobsTable.customerId, customerId));
  const jobIds = customerJobs.map((j) => j.id);

  const rows = await db
    .select()
    .from(paymentsTable)
    .where(
      jobIds.length > 0
        ? sql`${paymentsTable.customerId} = ${customerId} OR ${paymentsTable.jobId} IN (${sql.join(jobIds.map((id) => sql`${id}`), sql`, `)})`
        : eq(paymentsTable.customerId, customerId),
    );

  res.json(
    rows
      .sort((a, b) => {
        const ad = a.paidAt ? new Date(a.paidAt).getTime() : 0;
        const bd = b.paidAt ? new Date(b.paidAt).getTime() : 0;
        return bd - ad;
      })
      .map((p) => ({
        id: p.id,
        jobId: p.jobId,
        amount: p.amount,
        type: p.type,
        method: p.method,
        confirmationNumber: p.confirmationNumber,
        paymentRequestId: p.paymentRequestId,
        paidAt: p.paidAt instanceof Date ? p.paidAt.toISOString() : p.paidAt,
        notes: p.notes,
      })),
  );
});

// ─── Stripe checkout: balance pay & payment-request pay ─────────────────────

router.post("/customer/jobs/:id/balance-checkout", requireCustomer, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const customerId = req.customer!.customerId;
  const { job, quote } = await loadOwnedJobAndQuote(id, customerId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const balance = Number(job.remainingBalance ?? 0);
  if (balance <= 0) {
    res.status(409).json({ error: "No outstanding balance to pay." });
    return;
  }

  try {
    const { getUncachableStripeClient } = await import("../lib/stripe-client.js");
    const stripe = await getUncachableStripeClient();

    const baseUrl = getAppBaseUrl();
    const successUrl = `${baseUrl}/account/jobs/${id}?paid=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/account/jobs/${id}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(balance * 100),
            product_data: {
              name: `Remaining Balance — Job #${job.id}`,
              description: `Move on ${quote?.moveDate ?? "TBD"} for ${quote?.contactName ?? "Customer"}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        paymentType: "customer_balance_payment",
        jobId: String(job.id),
        customerJobId: String(job.id),
        customerId: String(customerId),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    logger.error({ err }, "Failed to create balance checkout session");
    res.status(500).json({ error: "Could not start payment. Please try again or call us." });
  }
});

router.post("/customer/payment-requests/:id/checkout", requireCustomer, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid payment request id" });
    return;
  }
  const customerId = req.customer!.customerId;
  const [pr] = await db.select().from(paymentRequestsTable).where(eq(paymentRequestsTable.id, id)).limit(1);
  if (!pr || pr.customerId !== customerId) {
    res.status(404).json({ error: "Payment request not found" });
    return;
  }
  if (pr.status !== "pending") {
    res.status(409).json({ error: `This request is already ${pr.status}.` });
    return;
  }

  try {
    const { getUncachableStripeClient } = await import("../lib/stripe-client.js");
    const stripe = await getUncachableStripeClient();
    const baseUrl = getAppBaseUrl();
    const successUrl = `${baseUrl}/account/payment-requests/${id}/pay?paid=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/account/payment-requests/${id}/pay`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: pr.amountCents,
            product_data: {
              name: `Teemer Moving — ${pr.description}`,
              description: `Payment Request #${pr.id}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        paymentType: "payment_request",
        paymentRequestId: String(pr.id),
        customerId: String(customerId),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    await db
      .update(paymentRequestsTable)
      .set({ stripeSessionId: session.id })
      .where(eq(paymentRequestsTable.id, id));

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    logger.error({ err }, "Failed to create payment-request checkout");
    res.status(500).json({ error: "Could not start payment. Please try again or call us." });
  }
});

export default router;
