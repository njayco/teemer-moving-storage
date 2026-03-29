import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  jobsTable,
  quoteRequestsTable,
  jobStatusEventsTable,
  emailLogsTable,
  paymentsTable,
  usersTable,
  invoicesTable,
} from "@workspace/db/schema";
import { eq, desc, count, sum, sql, or, ilike, and, isNotNull } from "drizzle-orm";
import { requireAdmin, requireCaptainOrAdmin } from "../lib/auth";
import { recordTimelineEvent } from "../lib/timeline";
import { sendRemainingBalanceInvoiceEmail, sendStatusUpdateEmail } from "../lib/email-service";

const CAPTAIN_STATUSES = [
  "scheduled", "en_route", "arrived", "in_progress",
  "at_storage", "returning", "complete", "delayed",
] as const;

const MILESTONE_EMAIL_STATUSES = new Set(["arrived", "in_progress", "at_storage", "complete"]);

const router: IRouter = Router();

const JOB_STATUSES = [
  "pending",
  "scheduled",
  "captain_assigned",
  "arrived",
  "in_progress",
  "at_storage",
  "awaiting_remaining_balance",
  "paid_in_cash",
  "complete",
  "cancelled",
] as const;

function formatJobRow(job: typeof jobsTable.$inferSelect, quote?: typeof quoteRequestsTable.$inferSelect | null) {
  return {
    id: String(job.id),
    jobId: job.jobId,
    customer: job.customer,
    provider: job.provider ?? undefined,
    pickupLocation: job.pickupLocation,
    destination: job.destination,
    moveType: job.moveType,
    dateTime: job.dateTime,
    estimatedPayout: job.estimatedPayout,
    specialRequirements: job.specialRequirements ?? undefined,
    jobSize: job.jobSize ?? undefined,
    status: job.status ?? "pending",
    assignedMover: job.assignedMover ?? undefined,
    truckStatus: job.truckStatus ?? undefined,
    eta: job.eta ?? undefined,
    trackingToken: job.trackingToken ?? undefined,
    quoteId: job.quoteId ?? undefined,
    customerId: job.customerId ?? undefined,
    assignedCaptainId: job.assignedCaptainId ?? undefined,
    arrivalWindow: job.arrivalWindow ?? undefined,
    originAddress: job.originAddress ?? undefined,
    destinationAddress: job.destinationAddress ?? undefined,
    crewSize: job.crewSize ?? undefined,
    estimatedHours: job.estimatedHours ?? undefined,
    hourlyRate: job.hourlyRate ?? undefined,
    estimateSubtotal: job.estimateSubtotal ?? undefined,
    extraCharges: job.extraCharges ?? undefined,
    discounts: job.discounts ?? undefined,
    finalTotal: job.finalTotal ?? undefined,
    depositPaid: job.depositPaid ?? undefined,
    remainingBalance: job.remainingBalance ?? undefined,
    paymentStatus: job.paymentStatus ?? "unpaid",
    invoiceStatus: job.invoiceStatus ?? "none",
    notes: job.notes ?? undefined,
    createdAt: job.createdAt?.toISOString() ?? undefined,
    updatedAt: job.updatedAt?.toISOString() ?? undefined,
    completedAt: job.completedAt?.toISOString() ?? undefined,
    quoteData: quote
      ? {
          contactName: quote.contactName,
          phone: quote.phone,
          email: quote.email,
          moveDate: quote.moveDate,
          arrivalTimeWindow: quote.arrivalTimeWindow || undefined,
          pickupAddress: quote.pickupAddress || quote.originAddress || undefined,
          dropoffAddress: quote.dropoffAddress || quote.destinationAddress || undefined,
          numberOfBedrooms: quote.numberOfBedrooms,
          numberOfLivingRooms: quote.numberOfLivingRooms,
          isFullyFurnished: quote.isFullyFurnished,
          hasStairs: quote.hasStairs,
          hasHeavyItems: quote.hasHeavyItems,
          storageNeeded: quote.storageNeeded,
          storageUnitChoice: quote.storageUnitChoice || undefined,
          additionalNotes: quote.additionalNotes || undefined,
          inventory: quote.inventory || {},
          totalEstimate: quote.totalEstimate,
          depositAmount: quote.depositAmount,
          crewSize: quote.crewSize,
          estimatedHours: quote.estimatedHours,
          laborSubtotal: quote.laborSubtotal,
          materialsSubtotal: quote.materialsSubtotal,
        }
      : undefined,
  };
}

function formatCaptainJobRow(job: typeof jobsTable.$inferSelect, quote?: typeof quoteRequestsTable.$inferSelect | null) {
  return {
    id: String(job.id),
    jobId: job.jobId,
    customer: job.customer,
    pickupLocation: job.pickupLocation,
    destination: job.destination,
    moveType: job.moveType,
    dateTime: job.dateTime,
    specialRequirements: job.specialRequirements ?? undefined,
    jobSize: job.jobSize ?? undefined,
    status: job.status ?? "pending",
    assignedMover: job.assignedMover ?? undefined,
    truckStatus: job.truckStatus ?? undefined,
    eta: job.eta ?? undefined,
    assignedCaptainId: job.assignedCaptainId ?? undefined,
    arrivalWindow: job.arrivalWindow ?? undefined,
    originAddress: job.originAddress ?? undefined,
    destinationAddress: job.destinationAddress ?? undefined,
    crewSize: job.crewSize ?? undefined,
    estimatedHours: job.estimatedHours ?? undefined,
    notes: job.notes ?? undefined,
    createdAt: job.createdAt?.toISOString() ?? undefined,
    updatedAt: job.updatedAt?.toISOString() ?? undefined,
    completedAt: job.completedAt?.toISOString() ?? undefined,
    quoteData: quote
      ? {
          contactName: quote.contactName,
          phone: quote.phone,
          email: quote.email,
          moveDate: quote.moveDate,
          arrivalTimeWindow: quote.arrivalTimeWindow || undefined,
          pickupAddress: quote.pickupAddress || quote.originAddress || undefined,
          dropoffAddress: quote.dropoffAddress || quote.destinationAddress || undefined,
          numberOfBedrooms: quote.numberOfBedrooms,
          numberOfLivingRooms: quote.numberOfLivingRooms,
          isFullyFurnished: quote.isFullyFurnished,
          hasStairs: quote.hasStairs,
          hasHeavyItems: quote.hasHeavyItems,
          storageNeeded: quote.storageNeeded,
          storageUnitChoice: quote.storageUnitChoice || undefined,
          additionalNotes: quote.additionalNotes || undefined,
          inventory: quote.inventory || {},
          crewSize: quote.crewSize,
          estimatedHours: quote.estimatedHours,
        }
      : undefined,
  };
}

router.get("/jobs", requireAdmin, async (req, res) => {
  try {
    const { status, search } = req.query;

    const conditions = [];

    if (status && typeof status === "string" && status !== "all") {
      conditions.push(eq(jobsTable.status, status));
    }

    if (search && typeof search === "string" && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(jobsTable.customer, term),
          ilike(jobsTable.jobId, term),
          ilike(jobsTable.pickupLocation, term),
          ilike(jobsTable.destination, term),
          ilike(jobsTable.dateTime, term),
          ilike(jobsTable.assignedMover, term),
          sql`EXISTS (SELECT 1 FROM ${quoteRequestsTable} WHERE ${quoteRequestsTable.id} = ${jobsTable.quoteId} AND (${ilike(quoteRequestsTable.email, term)} OR ${ilike(quoteRequestsTable.phone, term)} OR ${ilike(quoteRequestsTable.contactName, term)} OR ${ilike(quoteRequestsTable.moveDate, term)}))`,
          sql`EXISTS (SELECT 1 FROM ${invoicesTable} WHERE ${invoicesTable.jobId} = ${jobsTable.id} AND ${ilike(invoicesTable.invoiceNumber, term)})`,
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const jobs = await db
      .select()
      .from(jobsTable)
      .where(whereClause)
      .orderBy(desc(jobsTable.createdAt))
      .limit(200);

    const quoteIds = jobs.map((j) => j.quoteId).filter((id): id is number => id != null);
    let quotesMap = new Map<number, typeof quoteRequestsTable.$inferSelect>();
    if (quoteIds.length > 0) {
      const quotes = await db
        .select()
        .from(quoteRequestsTable)
        .where(sql`${quoteRequestsTable.id} = ANY(${quoteIds})`);
      for (const q of quotes) {
        quotesMap.set(q.id, q);
      }
    }

    res.json(jobs.map((job) => formatJobRow(job, quotesMap.get(job.quoteId!) || null)));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch jobs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/jobs", requireAdmin, async (req, res) => {
  try {
    const body = req.body;
    const jobId = `Job${Date.now().toString().slice(-3)}`;
    const [job] = await db
      .insert(jobsTable)
      .values({
        jobId,
        customer: body.customer,
        pickupLocation: body.pickupLocation,
        destination: body.destination,
        moveType: body.moveType,
        dateTime: body.dateTime,
        estimatedPayout: body.estimatedPayout,
        specialRequirements: body.specialRequirements,
        jobSize: body.jobSize,
        status: "pending",
        quoteId: body.quoteId || undefined,
        customerId: body.customerId || undefined,
        crewSize: body.crewSize || undefined,
        estimatedHours: body.estimatedHours || undefined,
        hourlyRate: body.hourlyRate || undefined,
        estimateSubtotal: body.estimateSubtotal || undefined,
        finalTotal: body.finalTotal || undefined,
        depositPaid: body.depositPaid || 0,
        remainingBalance: body.remainingBalance || undefined,
        originAddress: body.originAddress || body.pickupLocation,
        destinationAddress: body.destinationAddress || body.destination,
        arrivalWindow: body.arrivalWindow || undefined,
      })
      .returning();

    recordTimelineEvent({
      jobId: job.id,
      eventType: "job_created",
      statusLabel: "Job Created",
      visibleToCustomer: true,
      notes: `Job ${jobId} created`,
    }).catch(() => {});

    res.status(201).json(formatJobRow(job));
  } catch (err) {
    req.log.error({ err }, "Failed to create job");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/jobs/:jobId", requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;

    const [job] = await db
      .select()
      .from(jobsTable)
      .where(
        sql`${jobsTable.jobId} = ${jobId} OR CAST(${jobsTable.id} AS TEXT) = ${jobId}`,
      )
      .limit(1);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    let quote = null;
    if (job.quoteId) {
      const [q] = await db
        .select()
        .from(quoteRequestsTable)
        .where(eq(quoteRequestsTable.id, job.quoteId))
        .limit(1);
      quote = q || null;
    }

    const events = await db
      .select()
      .from(jobStatusEventsTable)
      .where(eq(jobStatusEventsTable.jobId, job.id))
      .orderBy(desc(jobStatusEventsTable.createdAt));

    let quoteEvents: typeof events = [];
    if (job.quoteId) {
      quoteEvents = await db
        .select()
        .from(jobStatusEventsTable)
        .where(eq(jobStatusEventsTable.jobId, job.quoteId))
        .orderBy(desc(jobStatusEventsTable.createdAt));
    }

    const emailLogs = await db
      .select()
      .from(emailLogsTable)
      .where(
        job.quoteId
          ? or(eq(emailLogsTable.jobId, job.id), eq(emailLogsTable.quoteId, job.quoteId))!
          : eq(emailLogsTable.jobId, job.id),
      )
      .orderBy(desc(emailLogsTable.sentAt));

    const payments = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.jobId, job.id))
      .orderBy(desc(paymentsTable.paidAt));

    const allEvents = [...events, ...quoteEvents]
      .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

    res.json({
      ...formatJobRow(job, quote),
      timeline: allEvents.map((e) => ({
        id: e.id,
        jobId: e.jobId,
        eventType: e.eventType,
        statusLabel: e.statusLabel,
        visibleToCustomer: e.visibleToCustomer,
        notes: e.notes,
        createdByUserId: e.createdByUserId,
        createdAt: e.createdAt?.toISOString() ?? null,
      })),
      emailLogs: emailLogs.map((e) => ({
        id: e.id,
        jobId: e.jobId,
        quoteId: e.quoteId,
        emailType: e.emailType,
        recipient: e.recipient,
        status: e.status,
        sentAt: e.sentAt?.toISOString() ?? null,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        jobId: p.jobId,
        type: p.type,
        method: p.method,
        amount: p.amount,
        reference: p.reference,
        paidAt: p.paidAt?.toISOString() ?? null,
        notes: p.notes,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get job");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/jobs/:jobId", requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const {
      status,
      assignedMover,
      truckStatus,
      eta,
      assignedCaptainId,
      paymentStatus,
      invoiceStatus,
      notes,
      extraCharges,
      discounts,
      finalTotal,
      remainingBalance,
    } = req.body;

    const [existing] = await db
      .select()
      .from(jobsTable)
      .where(
        sql`${jobsTable.jobId} = ${String(jobId)} OR CAST(${jobsTable.id} AS TEXT) = ${String(jobId)}`,
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Job not found" });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (assignedMover !== undefined) updates.assignedMover = assignedMover;
    if (truckStatus !== undefined) updates.truckStatus = truckStatus;
    if (eta !== undefined) updates.eta = eta;
    if (assignedCaptainId !== undefined) updates.assignedCaptainId = assignedCaptainId;
    if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus;
    if (invoiceStatus !== undefined) updates.invoiceStatus = invoiceStatus;
    if (notes !== undefined) updates.notes = notes;
    if (extraCharges !== undefined) updates.extraCharges = extraCharges;
    if (discounts !== undefined) updates.discounts = discounts;
    if (finalTotal !== undefined) updates.finalTotal = finalTotal;
    if (remainingBalance !== undefined) updates.remainingBalance = remainingBalance;

    if (status === "complete") {
      updates.completedAt = new Date();
    }

    let cashAmount = 0;
    if (paymentStatus === "paid_cash" && existing.paymentStatus !== "paid_cash") {
      cashAmount = existing.remainingBalance != null && existing.remainingBalance > 0
        ? existing.remainingBalance
        : (existing.finalTotal ?? existing.estimatedPayout ?? 0);
      if (updates.remainingBalance === undefined) {
        updates.remainingBalance = 0;
      }
    }

    const [updated] = await db
      .update(jobsTable)
      .set(updates)
      .where(eq(jobsTable.id, existing.id))
      .returning();

    if (status && status !== existing.status) {
      recordTimelineEvent({
        jobId: updated.id,
        eventType: "status_change",
        statusLabel: status,
        visibleToCustomer: true,
        notes: `Status changed from "${existing.status}" to "${status}"`,
        createdByUserId: req.user?.userId ?? undefined,
      }).catch(() => {});
    }

    if (assignedCaptainId && assignedCaptainId !== existing.assignedCaptainId) {
      const [captain] = await db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, assignedCaptainId))
        .limit(1);

      const captainName = captain?.name || assignedMover || `Captain #${assignedCaptainId}`;

      recordTimelineEvent({
        jobId: updated.id,
        eventType: "captain_assigned",
        statusLabel: "Captain Assigned",
        visibleToCustomer: true,
        notes: `Move captain assigned: ${captainName}`,
        createdByUserId: req.user?.userId ?? undefined,
      }).catch(() => {});
    }

    if (paymentStatus === "paid_cash" && existing.paymentStatus !== "paid_cash") {
      recordTimelineEvent({
        jobId: updated.id,
        eventType: "status_change",
        statusLabel: "Paid in Cash",
        visibleToCustomer: true,
        notes: `Payment marked as paid in cash ($${cashAmount})`,
        createdByUserId: req.user?.userId ?? undefined,
      }).catch(() => {});

      db.insert(paymentsTable)
        .values({
          jobId: updated.id,
          type: "remaining_balance",
          method: "cash",
          amount: cashAmount,
          notes: "Marked as paid in cash by admin",
        })
        .catch(() => {});
    }

    res.json(formatJobRow(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update job");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/jobs/:jobId/events", requireAdmin, async (req, res) => {
  try {
    const jobIdParam = String(req.params.jobId);
    const customerOnly = req.query.customerOnly === "true";

    const [job] = await db
      .select({ id: jobsTable.id, quoteId: jobsTable.quoteId })
      .from(jobsTable)
      .where(
        sql`${jobsTable.jobId} = ${jobIdParam} OR CAST(${jobsTable.id} AS TEXT) = ${jobIdParam}`,
      )
      .limit(1);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    let events = await db
      .select()
      .from(jobStatusEventsTable)
      .where(eq(jobStatusEventsTable.jobId, job.id))
      .orderBy(desc(jobStatusEventsTable.createdAt));

    if (job.quoteId) {
      const quoteEvents = await db
        .select()
        .from(jobStatusEventsTable)
        .where(eq(jobStatusEventsTable.jobId, job.quoteId))
        .orderBy(desc(jobStatusEventsTable.createdAt));
      events = [...events, ...quoteEvents].filter(
        (e, i, arr) => arr.findIndex((x) => x.id === e.id) === i,
      );
    }

    if (customerOnly) {
      events = events.filter((e) => e.visibleToCustomer);
    }

    res.json(
      events.map((e) => ({
        id: e.id,
        jobId: e.jobId,
        eventType: e.eventType,
        statusLabel: e.statusLabel,
        visibleToCustomer: e.visibleToCustomer,
        notes: e.notes,
        createdByUserId: e.createdByUserId,
        createdAt: e.createdAt?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fetch job events");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/jobs/:jobId/events", requireAdmin, async (req, res) => {
  try {
    const jobIdParam = String(req.params.jobId);

    const [job] = await db
      .select({ id: jobsTable.id })
      .from(jobsTable)
      .where(
        sql`${jobsTable.jobId} = ${jobIdParam} OR CAST(${jobsTable.id} AS TEXT) = ${jobIdParam}`,
      )
      .limit(1);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const { eventType, statusLabel, visibleToCustomer, notes } = req.body;

    if (!eventType) {
      res.status(400).json({ error: "eventType is required" });
      return;
    }

    const event = await recordTimelineEvent({
      jobId: job.id,
      eventType,
      statusLabel: statusLabel ?? undefined,
      visibleToCustomer: visibleToCustomer ?? true,
      notes: notes ?? undefined,
      createdByUserId: req.user?.userId ?? undefined,
    });

    if (!event) {
      res.status(500).json({ error: "Failed to create event" });
      return;
    }

    res.status(201).json({
      id: event.id,
      jobId: event.jobId,
      eventType: event.eventType,
      statusLabel: event.statusLabel,
      visibleToCustomer: event.visibleToCustomer,
      notes: event.notes,
      createdByUserId: event.createdByUserId,
      createdAt: event.createdAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create job event");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/jobs/:jobId/send-invoice", requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const [job] = await db.select().from(jobsTable)
      .where(sql`${jobsTable.jobId} = ${String(jobId)} OR CAST(${jobsTable.id} AS TEXT) = ${String(jobId)}`)
      .limit(1);
    if (!job) return res.status(404).json({ error: "Job not found" });

    let quote = null;
    if (job.quoteId) {
      const [q] = await db.select().from(quoteRequestsTable).where(eq(quoteRequestsTable.id, job.quoteId)).limit(1);
      quote = q ?? null;
    }
    const email = quote?.email;
    if (!email) return res.status(400).json({ error: "No customer email found for this job" });

    const remainingBalance = job.remainingBalance ?? (job.finalTotal ?? job.estimatedPayout ?? 0) - (job.depositPaid ?? 0);

    const result = await sendRemainingBalanceInvoiceEmail({
      email,
      customerName: quote?.contactName ?? job.customer ?? "Customer",
      quoteId: job.quoteId ?? job.id,
      totalEstimate: job.estimateSubtotal ?? job.estimatedPayout ?? 0,
      depositPaid: job.depositPaid ?? 0,
      extraCharges: job.extraCharges ?? 0,
      discounts: job.discounts ?? 0,
      finalTotal: job.finalTotal ?? job.estimatedPayout ?? 0,
      remainingBalance,
      moveDate: quote?.moveDate ?? job.dateTime ?? "",
    });

    if (!result.success) {
      return res.status(502).json({ success: false, error: "Failed to send invoice email" });
    }

    await db.update(jobsTable).set({ invoiceStatus: "sent", updatedAt: new Date() }).where(eq(jobsTable.id, job.id));

    recordTimelineEvent({
      jobId: job.id,
      eventType: "invoice_sent",
      statusLabel: "Invoice Sent",
      visibleToCustomer: true,
      notes: `Remaining balance invoice ($${remainingBalance.toFixed(2)}) sent to ${email}`,
      createdByUserId: req.user?.userId ?? undefined,
    }).catch(() => {});

    res.json({ success: true, message: "Invoice sent" });
  } catch (err) {
    req.log.error({ err }, "Failed to send invoice");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/jobs/:jobId/email-customer", requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { subject, message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const [job] = await db.select().from(jobsTable)
      .where(sql`${jobsTable.jobId} = ${String(jobId)} OR CAST(${jobsTable.id} AS TEXT) = ${String(jobId)}`)
      .limit(1);
    if (!job) return res.status(404).json({ error: "Job not found" });

    let quote = null;
    if (job.quoteId) {
      const [q] = await db.select().from(quoteRequestsTable).where(eq(quoteRequestsTable.id, job.quoteId)).limit(1);
      quote = q ?? null;
    }
    const email = quote?.email;
    if (!email) return res.status(400).json({ error: "No customer email found for this job" });

    const result = await sendStatusUpdateEmail({
      email,
      customerName: quote?.contactName ?? job.customer ?? "Customer",
      quoteId: job.quoteId ?? job.id,
      status: "update",
      statusLabel: subject ?? "Update from Teemer Moving",
      message,
    });

    if (!result.success) {
      return res.status(502).json({ success: false, error: "Failed to send email" });
    }

    recordTimelineEvent({
      jobId: job.id,
      eventType: "email_sent",
      statusLabel: "Customer Emailed",
      visibleToCustomer: false,
      notes: `Email sent to ${email}: ${subject ?? "Update"}`,
      createdByUserId: req.user?.userId ?? undefined,
    }).catch(() => {});

    res.json({ success: true, message: "Email sent" });
  } catch (err) {
    req.log.error({ err }, "Failed to email customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/stats", requireAdmin, async (req, res) => {
  try {
    const [jobAggs] = await db
      .select({
        totalJobs: count(jobsTable.id),
        pendingJobs: sum(
          sql`CASE WHEN ${jobsTable.status} IN ('pending', 'scheduled') THEN 1 ELSE 0 END`,
        ),
        inProgressJobs: sum(
          sql`CASE WHEN ${jobsTable.status} IN ('captain_assigned', 'arrived', 'in_progress', 'at_storage') THEN 1 ELSE 0 END`,
        ),
        completedJobs: sum(
          sql`CASE WHEN ${jobsTable.status} = 'complete' THEN 1 ELSE 0 END`,
        ),
        cancelledJobs: sum(
          sql`CASE WHEN ${jobsTable.status} = 'cancelled' THEN 1 ELSE 0 END`,
        ),
        totalDeposits: sum(jobsTable.depositPaid),
        totalRemainingBalance: sum(
          sql`CASE WHEN ${jobsTable.status} != 'complete' AND ${jobsTable.status} != 'cancelled' THEN COALESCE(${jobsTable.remainingBalance}, 0) ELSE 0 END`,
        ),
        cashPayments: sum(
          sql`CASE WHEN ${jobsTable.paymentStatus} = 'paid_cash' THEN COALESCE(${jobsTable.finalTotal}, ${jobsTable.estimatedPayout}) ELSE 0 END`,
        ),
        totalRevenue: sum(
          sql`CASE WHEN ${jobsTable.status} = 'complete' THEN COALESCE(${jobsTable.finalTotal}, ${jobsTable.estimatedPayout}) ELSE 0 END`,
        ),
      })
      .from(jobsTable);

    const [quoteAggs] = await db
      .select({
        totalQuotes: count(quoteRequestsTable.id),
        pendingQuotes: sum(
          sql`CASE WHEN ${quoteRequestsTable.status} IN ('quote_requested', 'pending') THEN 1 ELSE 0 END`,
        ),
        depositCollected: sum(
          sql`CASE WHEN ${quoteRequestsTable.status} IN ('deposit_paid', 'booked') THEN ${quoteRequestsTable.depositAmount} ELSE 0 END`,
        ),
        revenuePipeline: sum(quoteRequestsTable.totalEstimate),
      })
      .from(quoteRequestsTable);

    res.json({
      totalJobs: Number(jobAggs?.totalJobs ?? 0),
      pendingJobs: Number(jobAggs?.pendingJobs ?? 0),
      inProgressJobs: Number(jobAggs?.inProgressJobs ?? 0),
      completedJobs: Number(jobAggs?.completedJobs ?? 0),
      cancelledJobs: Number(jobAggs?.cancelledJobs ?? 0),
      totalDeposits: Number(jobAggs?.totalDeposits ?? 0),
      totalRemainingBalance: Number(jobAggs?.totalRemainingBalance ?? 0),
      cashPayments: Number(jobAggs?.cashPayments ?? 0),
      totalRevenue: Number(jobAggs?.totalRevenue ?? 0),
      totalQuotes: Number(quoteAggs?.totalQuotes ?? 0),
      pendingQuotes: Number(quoteAggs?.pendingQuotes ?? 0),
      depositCollected: Number(quoteAggs?.depositCollected ?? 0),
      revenuePipeline: Number(quoteAggs?.revenuePipeline ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/captain/jobs", requireCaptainOrAdmin, async (req, res) => {
  try {
    const isAdmin = req.user!.role === "admin";
    const whereClause = isAdmin
      ? isNotNull(jobsTable.assignedCaptainId)
      : eq(jobsTable.assignedCaptainId, req.user!.userId);

    const jobs = await db
      .select()
      .from(jobsTable)
      .where(whereClause)
      .orderBy(desc(jobsTable.createdAt));

    const quoteIds = jobs.map((j) => j.quoteId).filter((id): id is number => id != null);
    let quotesMap = new Map<number, typeof quoteRequestsTable.$inferSelect>();
    if (quoteIds.length > 0) {
      const quotes = await db
        .select()
        .from(quoteRequestsTable)
        .where(sql`${quoteRequestsTable.id} = ANY(${quoteIds})`);
      for (const q of quotes) {
        quotesMap.set(q.id, q);
      }
    }

    res.json(jobs.map((job) => formatCaptainJobRow(job, quotesMap.get(job.quoteId!) || null)));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch captain jobs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/jobs/:jobId/captain-status", requireCaptainOrAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, notes } = req.body;

    if (!status || !CAPTAIN_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Allowed: ${CAPTAIN_STATUSES.join(", ")}`,
      });
    }

    const [job] = await db
      .select()
      .from(jobsTable)
      .where(
        sql`${jobsTable.jobId} = ${String(jobId)} OR CAST(${jobsTable.id} AS TEXT) = ${String(jobId)}`,
      )
      .limit(1);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (req.user!.role === "move_captain" && job.assignedCaptainId !== req.user!.userId) {
      return res.status(403).json({ error: "You are not assigned to this job" });
    }

    const updates: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (notes !== undefined) {
      const existingNotes = job.notes || "";
      const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
      const newEntry = `[${timestamp}] ${notes.trim()}`;
      updates.notes = existingNotes ? `${existingNotes}\n${newEntry}` : newEntry;
    }

    if (status === "complete") {
      updates.completedAt = new Date();
    }

    const [updated] = await db
      .update(jobsTable)
      .set(updates)
      .where(eq(jobsTable.id, job.id))
      .returning();

    const statusLabels: Record<string, string> = {
      scheduled: "Scheduled",
      en_route: "En Route",
      arrived: "Arrived",
      in_progress: "In Progress",
      at_storage: "At Storage",
      returning: "Returning",
      complete: "Job Finished",
      delayed: "Delayed",
    };

    recordTimelineEvent({
      jobId: updated.id,
      eventType: "status_change",
      statusLabel: statusLabels[status] || status,
      visibleToCustomer: true,
      notes: notes
        ? `Captain updated status to "${statusLabels[status] || status}": ${notes}`
        : `Captain updated status to "${statusLabels[status] || status}"`,
      createdByUserId: req.user!.userId,
    }).catch(() => {});

    if (MILESTONE_EMAIL_STATUSES.has(status)) {
      let quote = null;
      if (job.quoteId) {
        const [q] = await db
          .select()
          .from(quoteRequestsTable)
          .where(eq(quoteRequestsTable.id, job.quoteId))
          .limit(1);
        quote = q ?? null;
      }
      const email = quote?.email;
      if (email) {
        sendStatusUpdateEmail({
          email,
          customerName: quote?.contactName ?? job.customer ?? "Customer",
          quoteId: job.quoteId ?? job.id,
          status,
          statusLabel: statusLabels[status] || status,
          message: `Your move status has been updated to: ${statusLabels[status] || status}`,
        }).catch(() => {});
      }
    }

    res.json(formatCaptainJobRow(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update captain status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/jobs/:jobId/captain-note", requireCaptainOrAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { notes } = req.body;

    if (!notes || !notes.trim()) {
      return res.status(400).json({ error: "Notes are required" });
    }

    const [job] = await db
      .select()
      .from(jobsTable)
      .where(
        sql`${jobsTable.jobId} = ${String(jobId)} OR CAST(${jobsTable.id} AS TEXT) = ${String(jobId)}`,
      )
      .limit(1);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (req.user!.role === "move_captain" && job.assignedCaptainId !== req.user!.userId) {
      return res.status(403).json({ error: "You are not assigned to this job" });
    }

    const existingNotes = job.notes || "";
    const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const newEntry = `[${timestamp}] ${notes.trim()}`;
    const updatedNotes = existingNotes ? `${existingNotes}\n${newEntry}` : newEntry;

    const [updated] = await db
      .update(jobsTable)
      .set({ notes: updatedNotes, updatedAt: new Date() })
      .where(eq(jobsTable.id, job.id))
      .returning();

    recordTimelineEvent({
      jobId: job.id,
      eventType: "captain_note",
      statusLabel: "Captain Note",
      visibleToCustomer: false,
      notes: notes.trim(),
      createdByUserId: req.user!.userId,
    }).catch(() => {});

    res.json(formatCaptainJobRow(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to add captain note");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
