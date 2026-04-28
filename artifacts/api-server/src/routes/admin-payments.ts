import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  customersTable,
  paymentRequestsTable,
  paymentsTable,
  jobsTable,
  quoteRequestsTable,
} from "@workspace/db/schema";
import { eq, desc, sql, ilike, or, and } from "drizzle-orm";
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

// ─── Admin payments view ────────────────────────────────────────────────────

router.get("/admin/payments", requireAdmin, async (req, res) => {
  const method = typeof req.query.method === "string" ? req.query.method : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const conds: ReturnType<typeof eq>[] = [];
  if (method && method !== "all") conds.push(eq(paymentsTable.method, method));

  const rows = await db
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
    .orderBy(desc(paymentsTable.paidAt));

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

  res.json(
    filtered.map((r) => ({
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
      job: r.job?.id ? r.job : null,
      quote: r.quote?.id ? r.quote : null,
      customer: r.customer?.id ? r.customer : null,
    })),
  );
});

export default router;
