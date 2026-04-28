import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  customersTable,
  paymentRequestsTable,
  paymentsTable,
  paymentRefundsTable,
  jobsTable,
  quoteRequestsTable,
} from "@workspace/db/schema";
import { eq, desc, sql, ilike, or, and, inArray } from "drizzle-orm";
import { requireAdmin, normalizeUsername } from "../lib/auth";
import { sendPaymentRequestNotificationEmail } from "../lib/email-service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getAppBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  const domain =
    process.env.REPLIT_DEPLOYMENT === "1"
      ? process.env.REPLIT_DOMAINS?.split(",")[0]
      : process.env.REPLIT_DEV_DOMAIN;
  return domain ? `https://${domain}` : "https://teemermoving.com";
}

// ─── Customer lookup (for the admin payment-request modal) ──────────────────

router.get("/admin/customers/lookup", requireAdmin, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.json([]);
    return;
  }
  const norm = q.startsWith("+") ? normalizeUsername(q) : q;
  const lower = q.toLowerCase();
  const isUsernameLike = q.startsWith("+");

  const rows = await db
    .select({
      id: customersTable.id,
      fullName: customersTable.fullName,
      email: customersTable.email,
      phone: customersTable.phone,
      username: customersTable.username,
      hasAccount: sql<boolean>`${customersTable.passwordHash} IS NOT NULL`,
    })
    .from(customersTable)
    .where(
      or(
        isUsernameLike ? eq(customersTable.username, norm) : sql`1=0`,
        ilike(customersTable.username, `%${q}%`),
        ilike(customersTable.email, `%${lower}%`),
        ilike(customersTable.fullName, `%${q}%`),
        ilike(customersTable.phone, `%${q}%`),
      ),
    )
    .limit(15);

  res.json(rows);
});

// ─── Payment requests ───────────────────────────────────────────────────────

router.post("/admin/payment-requests", requireAdmin, async (req, res) => {
  try {
    const usernameRaw = String(req.body?.username ?? "").trim();
    const customerIdRaw = req.body?.customerId;
    const amountCentsRaw = Number(req.body?.amountCents);
    const description = String(req.body?.description ?? "").trim();

    if (!description) {
      res.status(400).json({ error: "Description is required." });
      return;
    }
    if (!Number.isFinite(amountCentsRaw) || amountCentsRaw < 100) {
      res.status(400).json({ error: "Amount must be at least $1.00." });
      return;
    }
    const amountCents = Math.round(amountCentsRaw);

    let customer: typeof customersTable.$inferSelect | undefined;
    if (customerIdRaw) {
      const id = Number(customerIdRaw);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "Invalid customer id" });
        return;
      }
      [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    } else if (usernameRaw) {
      const normalized = normalizeUsername(usernameRaw);
      [customer] = await db
        .select()
        .from(customersTable)
        .where(eq(customersTable.username, normalized))
        .limit(1);
    } else {
      res.status(400).json({ error: "Provide a username or customerId." });
      return;
    }

    if (!customer) {
      res.status(404).json({ error: "Customer not found." });
      return;
    }
    if (!customer.passwordHash) {
      res.status(409).json({
        error:
          "This customer does not have an account yet. Ask them to sign up first or create one for them.",
      });
      return;
    }

    const [pr] = await db
      .insert(paymentRequestsTable)
      .values({
        customerId: customer.id,
        amountCents,
        description,
        status: "pending",
        createdByUserId: req.user?.userId ?? null,
      })
      .returning();

    const baseUrl = getAppBaseUrl();
    const payUrl = `${baseUrl}/account/payment-requests/${pr.id}/pay`;
    sendPaymentRequestNotificationEmail({
      email: customer.email,
      customerName: customer.fullName,
      amount: amountCents / 100,
      description,
      paymentRequestId: pr.id,
      payUrl,
    }).catch((err) => logger.error({ err }, "Failed to send payment request notification"));

    res.status(201).json({
      ...pr,
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        username: customer.username,
      },
      payUrl,
    });
  } catch (err) {
    logger.error({ err }, "Failed to create payment request");
    res.status(500).json({ error: "Could not create payment request." });
  }
});

router.get("/admin/payment-requests", requireAdmin, async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const conds = [] as ReturnType<typeof eq>[];
  if (status && status !== "all") conds.push(eq(paymentRequestsTable.status, status));

  const rows = await db
    .select({
      pr: paymentRequestsTable,
      customer: {
        id: customersTable.id,
        fullName: customersTable.fullName,
        email: customersTable.email,
        username: customersTable.username,
      },
    })
    .from(paymentRequestsTable)
    .leftJoin(customersTable, eq(paymentRequestsTable.customerId, customersTable.id))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(paymentRequestsTable.createdAt));

  res.json(rows.map((r) => ({ ...r.pr, customer: r.customer })));
});

// Cancel a pending payment request so the customer can no longer pay it.
router.post("/admin/payment-requests/:id/cancel", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [existing] = await db
      .select()
      .from(paymentRequestsTable)
      .where(eq(paymentRequestsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Payment request not found." });
      return;
    }
    if (existing.status === "paid") {
      res.status(409).json({ error: "Cannot cancel a payment request that has already been paid." });
      return;
    }
    if (existing.status === "cancelled") {
      // Idempotent: just return current state with customer info.
      const [c] = await db
        .select({
          id: customersTable.id,
          fullName: customersTable.fullName,
          email: customersTable.email,
          username: customersTable.username,
        })
        .from(customersTable)
        .where(eq(customersTable.id, existing.customerId))
        .limit(1);
      res.json({ ...existing, customer: c ?? null });
      return;
    }

    const [updated] = await db
      .update(paymentRequestsTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(paymentRequestsTable.id, id), eq(paymentRequestsTable.status, "pending")))
      .returning();

    if (!updated) {
      res.status(409).json({ error: "Payment request is no longer pending." });
      return;
    }

    // Defense in depth: if a Stripe Checkout session was issued for this
    // request, expire it so the customer cannot complete payment after
    // cancellation. Best-effort — log on failure but do not roll back.
    if (existing.stripeSessionId) {
      try {
        const { getUncachableStripeClient } = await import("../lib/stripe-client.js");
        const stripe = await getUncachableStripeClient();
        await stripe.checkout.sessions.expire(existing.stripeSessionId);
        logger.info(
          { paymentRequestId: id, sessionId: existing.stripeSessionId },
          "Expired Stripe Checkout session for cancelled payment request",
        );
      } catch (err) {
        const stripeErr = err as { code?: string; message?: string };
        // Already-expired / completed sessions throw; treat as benign.
        if (stripeErr.code === "checkout_session_already_expired") {
          logger.info(
            { paymentRequestId: id, sessionId: existing.stripeSessionId },
            "Stripe session was already expired",
          );
        } else {
          logger.error(
            { err, paymentRequestId: id, sessionId: existing.stripeSessionId },
            "Failed to expire Stripe Checkout session on cancel",
          );
        }
      }
    }

    const [c] = await db
      .select({
        id: customersTable.id,
        fullName: customersTable.fullName,
        email: customersTable.email,
        username: customersTable.username,
      })
      .from(customersTable)
      .where(eq(customersTable.id, updated.customerId))
      .limit(1);

    res.json({ ...updated, customer: c ?? null });
  } catch (err) {
    logger.error({ err }, "Failed to cancel payment request");
    res.status(500).json({ error: "Could not cancel payment request." });
  }
});

// ─── Admin payments view ────────────────────────────────────────────────────

interface PaymentJoinRow {
  payment: typeof paymentsTable.$inferSelect;
  job: { id: number | null; status: string | null; customer: string | null } | null;
  quote: {
    id: number | null;
    contactName: string | null;
    email: string | null;
    moveDate: string | null;
  } | null;
  customer: {
    id: number | null;
    fullName: string | null;
    email: string | null;
    username: string | null;
  } | null;
}

function shapePaymentRow(
  r: PaymentJoinRow,
  refunds: (typeof paymentRefundsTable.$inferSelect)[],
) {
  const refundedAmount = refunds.reduce((s, x) => s + (x.amount ?? 0), 0);
  const refundedAt = refunds.length
    ? refunds
        .map((x) => x.createdAt instanceof Date ? x.createdAt.toISOString() : (x.createdAt as unknown as string | null))
        .filter((v): v is string => Boolean(v))
        .sort()
        .pop() ?? null
    : null;
  return {
    id: r.payment.id,
    jobId: r.payment.jobId,
    customerId: r.payment.customerId,
    paymentRequestId: r.payment.paymentRequestId,
    type: r.payment.type,
    method: r.payment.method,
    amount: r.payment.amount,
    reference: r.payment.reference,
    confirmationNumber: r.payment.confirmationNumber,
    paidAt: r.payment.paidAt instanceof Date ? r.payment.paidAt.toISOString() : r.payment.paidAt,
    notes: r.payment.notes,
    refundedAmount,
    refundedAt,
    refunds: refunds.map((x) => ({
      id: x.id,
      paymentId: x.paymentId,
      amount: x.amount,
      reason: x.reason,
      status: x.status,
      stripeRefundId: x.stripeRefundId,
      notes: x.notes,
      createdAt:
        x.createdAt instanceof Date ? x.createdAt.toISOString() : (x.createdAt as unknown as string | null),
    })),
    job: r.job?.id ? r.job : null,
    quote: r.quote?.id ? r.quote : null,
    customer: r.customer?.id ? r.customer : null,
  };
}

router.get("/admin/payments", requireAdmin, async (req, res) => {
  const method = typeof req.query.method === "string" ? req.query.method : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const conds: ReturnType<typeof eq>[] = [];
  if (method && method !== "all") conds.push(eq(paymentsTable.method, method));

  const rows = (await db
    .select({
      payment: paymentsTable,
      job: {
        id: jobsTable.id,
        status: jobsTable.status,
        customer: jobsTable.customer,
      },
      quote: {
        id: quoteRequestsTable.id,
        contactName: quoteRequestsTable.contactName,
        email: quoteRequestsTable.email,
        moveDate: quoteRequestsTable.moveDate,
      },
      customer: {
        id: customersTable.id,
        fullName: customersTable.fullName,
        email: customersTable.email,
        username: customersTable.username,
      },
    })
    .from(paymentsTable)
    .leftJoin(jobsTable, eq(paymentsTable.jobId, jobsTable.id))
    .leftJoin(quoteRequestsTable, eq(jobsTable.quoteId, quoteRequestsTable.id))
    .leftJoin(customersTable, eq(paymentsTable.customerId, customersTable.id))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(paymentsTable.paidAt))) as unknown as PaymentJoinRow[];

  let filtered = rows;
  if (search) {
    const s = search.toLowerCase();
    filtered = rows.filter(
      (r) =>
        (r.payment.confirmationNumber ?? "").toLowerCase().includes(s) ||
        (r.payment.reference ?? "").toLowerCase().includes(s) ||
        (r.job?.customer ?? "").toLowerCase().includes(s) ||
        (r.quote?.contactName ?? "").toLowerCase().includes(s) ||
        (r.quote?.email ?? "").toLowerCase().includes(s) ||
        (r.customer?.fullName ?? "").toLowerCase().includes(s) ||
        (r.customer?.email ?? "").toLowerCase().includes(s) ||
        (r.customer?.username ?? "").toLowerCase().includes(s) ||
        String(r.payment.id).includes(s) ||
        String(r.payment.jobId ?? "").includes(s),
    );
  }

  // Fetch all refunds for these payments in one query.
  const paymentIds = filtered.map((r) => r.payment.id);
  const refunds =
    paymentIds.length > 0
      ? await db
          .select()
          .from(paymentRefundsTable)
          .where(inArray(paymentRefundsTable.paymentId, paymentIds))
      : [];
  const refundsByPayment = new Map<number, (typeof paymentRefundsTable.$inferSelect)[]>();
  for (const r of refunds) {
    const list = refundsByPayment.get(r.paymentId) ?? [];
    list.push(r);
    refundsByPayment.set(r.paymentId, list);
  }

  res.json(filtered.map((r) => shapePaymentRow(r, refundsByPayment.get(r.payment.id) ?? [])));
});

// Issue a refund (full or partial) against a Stripe payment.
router.post("/admin/payments/:id/refund", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid payment id" });
      return;
    }

    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, id))
      .limit(1);
    if (!payment) {
      res.status(404).json({ error: "Payment not found." });
      return;
    }
    if (payment.method !== "stripe") {
      res.status(400).json({
        error: "Only Stripe card payments can be refunded here. Refund cash/check payments outside the system.",
      });
      return;
    }

    const requestedAmount = Number(req.body?.amount);
    const allowedReasons = ["duplicate", "fraudulent", "requested_by_customer"] as const;
    const rawReason = req.body?.reason;
    if (rawReason !== undefined && rawReason !== null && !allowedReasons.includes(rawReason as typeof allowedReasons[number])) {
      res.status(400).json({
        error: `Invalid refund reason. Must be one of: ${allowedReasons.join(", ")}.`,
      });
      return;
    }
    const stripeReason = (typeof rawReason === "string" ? rawReason : "requested_by_customer") as
      typeof allowedReasons[number];
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";

    // Compute remaining refundable amount from already recorded refunds.
    const existingRefunds = await db
      .select()
      .from(paymentRefundsTable)
      .where(eq(paymentRefundsTable.paymentId, payment.id));
    const alreadyRefunded = existingRefunds.reduce((s, r) => s + (r.amount ?? 0), 0);
    const refundable = Math.max(0, Number((payment.amount - alreadyRefunded).toFixed(2)));
    if (refundable <= 0) {
      res.status(409).json({ error: "This payment has already been fully refunded." });
      return;
    }

    let refundDollars: number;
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      // Default to full remaining refund.
      refundDollars = refundable;
    } else {
      refundDollars = Number(requestedAmount.toFixed(2));
    }
    if (refundDollars > refundable + 0.001) {
      res.status(400).json({
        error: `Refund amount $${refundDollars.toFixed(2)} exceeds refundable amount $${refundable.toFixed(2)}.`,
      });
      return;
    }
    const refundCents = Math.round(refundDollars * 100);
    if (refundCents < 1) {
      res.status(400).json({ error: "Refund amount must be at least $0.01." });
      return;
    }

    // Resolve the Stripe PaymentIntent. The `reference` field stores the
    // Checkout Session ID (cs_…) for our flows; we need the PaymentIntent
    // (pi_…) to issue a refund.
    const { getUncachableStripeClient } = await import("../lib/stripe-client.js");
    const stripe = await getUncachableStripeClient();

    // Allow either pi_…, ch_…, or cs_… in reference.
    let paymentIntentId: string | null = null;
    let chargeId: string | null = null;
    const ref = payment.reference ?? "";
    if (ref.startsWith("pi_")) {
      paymentIntentId = ref;
    } else if (ref.startsWith("ch_")) {
      chargeId = ref;
    } else if (ref.startsWith("cs_")) {
      const session = await stripe.checkout.sessions.retrieve(ref);
      paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
    }

    if (!paymentIntentId && !chargeId) {
      res.status(400).json({
        error: "Cannot locate the underlying Stripe charge for this payment.",
      });
      return;
    }

    let stripeRefund;
    try {
      stripeRefund = await stripe.refunds.create({
        ...(paymentIntentId ? { payment_intent: paymentIntentId } : { charge: chargeId! }),
        amount: refundCents,
        reason: stripeReason as "duplicate" | "fraudulent" | "requested_by_customer",
        metadata: {
          adminUserId: String(req.user?.userId ?? ""),
          paymentId: String(payment.id),
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Stripe refund failed";
      req.log.error({ err, paymentId: payment.id }, "Stripe refund failed");
      res.status(502).json({ error: `Stripe refund failed: ${msg}` });
      return;
    }

    // Record the refund. Use upsert via the unique stripe_refund_id index so
    // a webhook race for the same refund is idempotent.
    const refundAmountDollars = (stripeRefund.amount ?? refundCents) / 100;
    const resolvedChargeId =
      typeof stripeRefund.charge === "string"
        ? stripeRefund.charge
        : stripeRefund.charge?.id ?? chargeId;

    await db
      .insert(paymentRefundsTable)
      .values({
        paymentId: payment.id,
        stripeRefundId: stripeRefund.id,
        stripeChargeId: resolvedChargeId ?? null,
        amount: refundAmountDollars,
        reason: stripeReason,
        status: stripeRefund.status ?? "succeeded",
        createdByUserId: req.user?.userId ?? null,
        notes: notes || null,
      })
      .onConflictDoNothing({ target: paymentRefundsTable.stripeRefundId });

    // Re-fetch the payment row and its refunds to return the updated AdminPaymentRow.
    const [refreshed] = (await db
      .select({
        payment: paymentsTable,
        job: {
          id: jobsTable.id,
          status: jobsTable.status,
          customer: jobsTable.customer,
        },
        quote: {
          id: quoteRequestsTable.id,
          contactName: quoteRequestsTable.contactName,
          email: quoteRequestsTable.email,
          moveDate: quoteRequestsTable.moveDate,
        },
        customer: {
          id: customersTable.id,
          fullName: customersTable.fullName,
          email: customersTable.email,
          username: customersTable.username,
        },
      })
      .from(paymentsTable)
      .leftJoin(jobsTable, eq(paymentsTable.jobId, jobsTable.id))
      .leftJoin(quoteRequestsTable, eq(jobsTable.quoteId, quoteRequestsTable.id))
      .leftJoin(customersTable, eq(paymentsTable.customerId, customersTable.id))
      .where(eq(paymentsTable.id, payment.id))
      .limit(1)) as unknown as PaymentJoinRow[];
    const refundsForRow = await db
      .select()
      .from(paymentRefundsTable)
      .where(eq(paymentRefundsTable.paymentId, payment.id));

    req.log.info(
      { paymentId: payment.id, refundId: stripeRefund.id, amount: refundAmountDollars },
      "Stripe refund issued by admin",
    );

    res.json(shapePaymentRow(refreshed, refundsForRow));
  } catch (err) {
    logger.error({ err }, "Failed to issue refund");
    res.status(500).json({ error: "Could not issue refund." });
  }
});

export default router;
