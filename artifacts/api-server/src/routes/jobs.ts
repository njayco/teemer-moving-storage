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
  revenueLedgerTable,
} from "@workspace/db/schema";
import { eq, desc, count, sum, sql, or, ilike, and, isNotNull, gte, lte, inArray } from "drizzle-orm";
import { requireAdmin, requireCaptainOrAdmin } from "../lib/auth";
import { recordTimelineEvent } from "../lib/timeline";
import { sendRemainingBalanceInvoiceEmail, sendStatusUpdateEmail, sendSameDayCaptainAlert } from "../lib/email-service";
import { getEffectiveMountedTVFee } from "../lib/pricing-engine.js";

// Seed packing-supplies line items from a quote's pricing inputs so the admin
// invoice editor isn't blank — pre-fills small/medium boxes, tape, and stretch
// wrap using the same per-unit prices as the public pricing engine.
function seedSuppliesItemsFromQuote(quote: typeof quoteRequestsTable.$inferSelect | null | undefined): Array<{ name: string; quantity: number; unitPrice: number }> {
  if (!quote) return [];
  const items: Array<{ name: string; quantity: number; unitPrice: number }> = [];
  const smallBoxes = quote.smallBoxes ?? 0;
  const mediumBoxes = quote.mediumBoxes ?? 0;
  if (smallBoxes > 0) items.push({ name: "Small Boxes", quantity: smallBoxes, unitPrice: 3.5 });
  if (mediumBoxes > 0) items.push({ name: "Medium Boxes", quantity: mediumBoxes, unitPrice: 6.5 });
  if (quote.needsPackingMaterials) {
    const bedrooms = Math.max(1, quote.numberOfBedrooms ?? 1);
    const stretchWrapPerBedroom = quote.isFullyFurnished ? 2 : 1;
    items.push({ name: "Stretch Wrap (rolls)", quantity: stretchWrapPerBedroom * bedrooms, unitPrice: 55 });
    items.push({ name: "Packing Tape (rolls)", quantity: bedrooms, unitPrice: 13.5 });
  }
  // Task #45: pre-fill the wall-mounted TV dismount/remount service so admins
  // don't have to remember to bill it. Editable like any other invoice line.
  // Only seed the TV line item if the original quote actually charged for
  // it (snapshot > 0). For legacy quotes that have hasMountedTVs=true but
  // no fee snapshot, the original `total_estimate` did NOT include a TV
  // fee, so silently pre-populating one would invoice the customer for a
  // service they were never quoted. The admin can still add it manually
  // if the customer agrees.
  const effectiveFee = getEffectiveMountedTVFee({
    hasMountedTVs: quote.hasMountedTVs,
    storedFee: quote.mountedTVFee,
  });
  if (effectiveFee > 0 && (quote.mountedTVCount ?? 0) > 0) {
    const tvCount = quote.mountedTVCount ?? 1;
    items.push({
      name: "Wall-Mounted TV Dismount/Remount",
      quantity: tvCount,
      unitPrice: Math.round((effectiveFee / tvCount) * 100) / 100,
    });
  }
  return items;
}

async function computeTotalPaidAndRemaining(
  jobId: number,
  depositPaidOnJob: number,
  finalTotal: number,
): Promise<{ totalPaid: number; remainingBalance: number }> {
  const [result] = await db.select({
    depositPayments: sum(sql`CASE WHEN ${paymentsTable.type} = 'deposit' THEN ${paymentsTable.amount} ELSE 0 END`),
    nonDepositPayments: sum(sql`CASE WHEN ${paymentsTable.type} != 'deposit' THEN ${paymentsTable.amount} ELSE 0 END`),
  }).from(paymentsTable).where(eq(paymentsTable.jobId, jobId));

  const depositFromRows = Number(result?.depositPayments ?? 0);
  const nonDepositFromRows = Number(result?.nonDepositPayments ?? 0);

  const depositComponent = Math.max(depositFromRows, depositPaidOnJob);
  const totalPaid = depositComponent + nonDepositFromRows;
  const remainingBalance = Math.max(0, finalTotal - totalPaid);
  return { totalPaid, remainingBalance };
}

const CAPTAIN_STATUSES = [
  "scheduled", "en_route", "arrived", "in_progress",
  "at_storage", "returning", "complete", "delayed", "finished",
] as const;

const MILESTONE_EMAIL_STATUSES = new Set(["arrived", "in_progress", "at_storage", "complete"]);

function isSameDay(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    const parsedStr = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    return parsedStr === todayStr;
  }
  return dateStr.startsWith(todayStr);
}

const router: IRouter = Router();

const JOB_STATUSES = [
  "pending",
  "scheduled",
  "captain_assigned",
  "en_route",
  "arrived",
  "in_progress",
  "at_storage",
  "returning",
  "delayed",
  "finished",
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
    parkingInstructions: job.parkingInstructions ?? (quote?.parkingInstructions ?? undefined),
    packingDate: job.packingDate ?? (quote?.packingDate ?? undefined),
    packingArrivalWindow: job.packingArrivalWindow ?? (quote?.packingArrivalWindow ?? undefined),
    hasMountedTVs: (job.hasMountedTVs ?? 0) > 0 ? 1 : (quote?.hasMountedTVs ? 1 : 0),
    mountedTVCount: job.mountedTVCount ?? (quote?.mountedTVCount ?? 0),
    discountCode: job.discountCode ?? (quote?.discountCode ?? undefined),
    discountAmount: job.discountAmount ?? (quote?.discountAmount ?? undefined),
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
        .where(inArray(quoteRequestsTable.id, quoteIds));
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

    if ((job.depositPaid ?? 0) > 0) {
      const existingDeposit = await db.select().from(paymentsTable)
        .where(and(eq(paymentsTable.jobId, job.id), eq(paymentsTable.type, "deposit")))
        .limit(1);
      if (existingDeposit.length === 0) {
        const depositAmount = job.depositPaid ?? 0;
        await db.insert(paymentsTable).values({
          jobId: job.id,
          type: "deposit",
          method: "stripe",
          amount: depositAmount,
          notes: `Deposit recorded at job creation`,
        });
        await db.insert(revenueLedgerTable).values({
          jobId: job.id,
          category: "deposit",
          amount: depositAmount,
        });
        recordTimelineEvent({
          jobId: job.id,
          eventType: "payment_recorded",
          statusLabel: "Deposit Recorded",
          visibleToCustomer: true,
          notes: `Deposit of $${depositAmount.toFixed(2)} recorded`,
        }).catch(() => {});
      }
    }

    if (isSameDay(job.dateTime ?? "")) {
      sendSameDayCaptainAlert({
        jobId: job.jobId,
        jobId_db: job.id,
        customerName: job.customer,
        moveDate: job.dateTime ?? "",
        arrivalWindow: job.arrivalWindow ?? undefined,
        pickupAddress: job.originAddress ?? job.pickupLocation,
        destinationAddress: job.destinationAddress ?? job.destination,
        crewSize: job.crewSize ?? undefined,
        estimatedHours: job.estimatedHours ?? undefined,
        notes: job.specialRequirements ?? undefined,
      }).catch(() => {});
    }

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
      estimatedHours,
      dateTime,
      parkingInstructions,
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
    if (estimatedHours !== undefined) updates.estimatedHours = estimatedHours;
    if (dateTime !== undefined) updates.dateTime = dateTime;
    if (parkingInstructions !== undefined) {
      updates.parkingInstructions = typeof parkingInstructions === "string"
        ? parkingInstructions.slice(0, 4000)
        : null;
    }

    if (status === "complete") {
      updates.completedAt = new Date();
    }

    if (status === "complete") {
      const ps = paymentStatus ?? existing.paymentStatus;
      if (ps !== "paid_cash" && ps !== "paid") {
        const total = existing.finalTotal ?? existing.estimatedPayout ?? 0;
        const { remainingBalance: actualOutstanding } = await computeTotalPaidAndRemaining(
          existing.id, existing.depositPaid ?? 0, total);
        if (actualOutstanding > 0) {
          return res.status(400).json({
            error: "Cannot mark complete: remaining balance must be $0 or payment must be marked as paid.",
          });
        }
      }
    }

    if (paymentStatus === "paid_cash" && existing.paymentStatus !== "paid_cash"
        && (existing.status === "finished" || existing.status === "awaiting_remaining_balance")) {
      updates.status = "complete";
      updates.completedAt = new Date();
    }

    if (estimatedHours !== undefined && typeof estimatedHours === "number" && estimatedHours > 0
        && (existing.status === "finished" || existing.status === "awaiting_remaining_balance")) {
      const hourlyRate = existing.hourlyRate ?? 0;
      const subtotal = estimatedHours * hourlyRate;
      const extras = (extraCharges !== undefined ? extraCharges : existing.extraCharges) ?? 0;
      const adminDisc = (discounts !== undefined ? discounts : existing.discounts) ?? 0;
      const promoDisc = existing.discountAmount ?? 0;
      const newFinalTotal = Math.max(0, subtotal + extras - adminDisc - promoDisc);
      updates.finalTotal = newFinalTotal;
      updates.estimateSubtotal = subtotal;
      const depositApplied = existing.depositPaid ?? 0;
      const { remainingBalance: newRemaining } = await computeTotalPaidAndRemaining(
        existing.id, depositApplied, newFinalTotal);
      updates.remainingBalance = newRemaining;
      const [existingInvoice] = await db.select().from(invoicesTable)
        .where(eq(invoicesTable.jobId, existing.id)).limit(1);
      if (existingInvoice) {
        await db.update(invoicesTable).set({
          subtotal,
          finalTotal: newFinalTotal,
          depositApplied,
          remainingBalanceDue: newRemaining,
          updatedAt: new Date(),
        }).where(eq(invoicesTable.id, existingInvoice.id));
      }
    }

    let cashAmount = 0;
    if (paymentStatus === "paid_cash" && existing.paymentStatus !== "paid_cash") {
      const total = existing.finalTotal ?? existing.estimatedPayout ?? 0;
      const { remainingBalance: outstanding } = await computeTotalPaidAndRemaining(
        existing.id, existing.depositPaid ?? 0, total);
      cashAmount = outstanding;
      if (updates.remainingBalance === undefined) {
        updates.remainingBalance = 0;
      }
    }

    let updated: typeof existing;
    if (paymentStatus === "paid_cash" && existing.paymentStatus !== "paid_cash" && cashAmount > 0) {
      [updated] = await db.transaction(async (tx) => {
        const [jobRow] = await tx
          .update(jobsTable)
          .set(updates)
          .where(eq(jobsTable.id, existing.id))
          .returning();

        const [payment] = await tx.insert(paymentsTable)
          .values({
            jobId: jobRow.id,
            type: "remaining_balance",
            method: "cash",
            amount: cashAmount,
            notes: "Marked as paid in cash by admin",
          })
          .returning();

        if (payment) {
          await tx.insert(revenueLedgerTable).values({
            jobId: jobRow.id,
            paymentId: payment.id,
            category: "cash_payment",
            amount: cashAmount,
          });
        }

        if (jobRow.status === "complete") {
          const [existingInvoice] = await tx.select().from(invoicesTable)
            .where(eq(invoicesTable.jobId, jobRow.id)).limit(1);
          if (existingInvoice) {
            await tx.update(invoicesTable).set({
              status: "paid",
              paidAt: new Date(),
              remainingBalanceDue: 0,
              updatedAt: new Date(),
            }).where(eq(invoicesTable.id, existingInvoice.id));
          }
        }

        return [jobRow];
      });
    } else {
      [updated] = await db
        .update(jobsTable)
        .set(updates)
        .where(eq(jobsTable.id, existing.id))
        .returning();
    }

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

    let resolvedCaptainName: string | undefined;
    if (assignedCaptainId && assignedCaptainId !== existing.assignedCaptainId) {
      const [captain] = await db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, assignedCaptainId))
        .limit(1);

      resolvedCaptainName = captain?.name || assignedMover || `Captain #${assignedCaptainId}`;

      recordTimelineEvent({
        jobId: updated.id,
        eventType: "captain_assigned",
        statusLabel: "Captain Assigned",
        visibleToCustomer: true,
        notes: `Move captain assigned: ${resolvedCaptainName}`,
        createdByUserId: req.user?.userId ?? undefined,
      }).catch(() => {});
    }

    if (paymentStatus === "paid_cash" && existing.paymentStatus !== "paid_cash") {
      recordTimelineEvent({
        jobId: updated.id,
        eventType: "status_change",
        statusLabel: "Paid in Cash",
        visibleToCustomer: true,
        notes: `Payment marked as paid in cash ($${cashAmount.toFixed(2)})`,
        createdByUserId: req.user?.userId ?? undefined,
      }).catch(() => {});
    }

    const effectiveDate = dateTime !== undefined ? dateTime : (existing.dateTime ?? "");
    const dateChangedToToday =
      dateTime !== undefined &&
      dateTime !== existing.dateTime &&
      isSameDay(dateTime) &&
      !isSameDay(existing.dateTime ?? "");
    const captainAssignedToSameDayJob =
      assignedCaptainId &&
      assignedCaptainId !== existing.assignedCaptainId &&
      isSameDay(effectiveDate);

    if (dateChangedToToday || captainAssignedToSameDayJob) {
      const [existingAlert] = await db
        .select({ id: emailLogsTable.id })
        .from(emailLogsTable)
        .where(
          and(
            eq(emailLogsTable.jobId, updated.id),
            eq(emailLogsTable.emailType, "same_day_captain_alert"),
            eq(emailLogsTable.status, "sent"),
          ),
        )
        .limit(1);

      if (!existingAlert) {
        let alertCaptainName = resolvedCaptainName;
        if (!alertCaptainName && updated.assignedCaptainId) {
          const [existingCaptain] = await db
            .select({ name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.id, updated.assignedCaptainId))
            .limit(1);
          alertCaptainName = existingCaptain?.name || updated.assignedMover || undefined;
        }
        sendSameDayCaptainAlert({
          jobId: updated.jobId,
          jobId_db: updated.id,
          customerName: updated.customer,
          moveDate: effectiveDate,
          arrivalWindow: updated.arrivalWindow ?? undefined,
          pickupAddress: updated.originAddress ?? updated.pickupLocation,
          destinationAddress: updated.destinationAddress ?? updated.destination,
          crewSize: updated.crewSize ?? undefined,
          estimatedHours: updated.estimatedHours ?? undefined,
          notes: updated.specialRequirements ?? undefined,
          captainName: alertCaptainName,
        }).catch(() => {});
      }
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

    let quote: typeof quoteRequestsTable.$inferSelect | null = null;
    if (job.quoteId) {
      const [q] = await db.select().from(quoteRequestsTable).where(eq(quoteRequestsTable.id, job.quoteId)).limit(1);
      quote = q ?? null;
    }
    const email = quote?.email;
    if (!email) return res.status(400).json({ error: "No customer email found for this job" });

    const finalTotal = job.finalTotal ?? job.estimatedPayout ?? 0;
    const { totalPaid, remainingBalance } = await computeTotalPaidAndRemaining(
      job.id, job.depositPaid ?? 0, finalTotal);

    const [existingInvoice] = await db.select().from(invoicesTable)
      .where(eq(invoicesTable.jobId, job.id)).limit(1);

    const now = new Date();
    const dueDateStr = existingInvoice?.dueDate ?? new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);

    // Invoice discounts row: combine admin-applied discounts and the customer's
    // discount-code amount (e.g. SANDV10) so the invoice always reflects the
    // savings the customer actually received.
    const invoiceDiscounts = (job.discounts ?? 0) + (job.discountAmount ?? 0);

    let invoiceNumber = existingInvoice?.invoiceNumber ?? "";
    if (!existingInvoice) {
      invoiceNumber = `INV-${job.jobId || job.id}-${Date.now().toString(36).toUpperCase()}`;
      await db.insert(invoicesTable).values({
        jobId: job.id,
        invoiceNumber,
        subtotal: job.estimateSubtotal ?? finalTotal,
        extraCharges: job.extraCharges ?? 0,
        discounts: invoiceDiscounts,
        finalTotal,
        depositApplied: job.depositPaid ?? 0,
        remainingBalanceDue: remainingBalance,
        dueDate: dueDateStr,
        status: "draft",
      });
    } else {
      invoiceNumber = existingInvoice.invoiceNumber;
    }

    const baseUrl = process.env.APP_BASE_URL
      || (process.env.REPLIT_DEPLOYMENT === "1"
        ? `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`
        : `https://${process.env.REPLIT_DEV_DOMAIN}`);
    const payLink = quote?.trackingToken
      ? `${baseUrl}/track/${job.quoteId ?? job.id}/${quote.trackingToken}`
      : undefined;

    const editableSnapshot = (existingInvoice?.editableSnapshotJson ?? null) as {
      numTrucks?: number;
      crewSize?: number;
      freeformText?: string;
      suppliesItems?: Array<{ name: string; quantity: number; unitPrice: number }>;
    } | null;
    // If the admin hasn't edited supplies yet, seed them from the quote's
    // pricing breakdown so the customer's invoice email includes the boxes,
    // tape, and stretch-wrap line items they were already quoted for.
    const finalSuppliesItems = (editableSnapshot?.suppliesItems && editableSnapshot.suppliesItems.length > 0)
      ? editableSnapshot.suppliesItems
      : seedSuppliesItemsFromQuote(quote);

    const result = await sendRemainingBalanceInvoiceEmail({
      email,
      customerName: quote?.contactName ?? job.customer ?? "Customer",
      quoteId: job.quoteId ?? job.id,
      totalEstimate: job.estimateSubtotal ?? job.estimatedPayout ?? 0,
      depositPaid: job.depositPaid ?? 0,
      extraCharges: job.extraCharges ?? 0,
      discounts: invoiceDiscounts,
      finalTotal,
      remainingBalance,
      moveDate: quote?.moveDate ?? job.dateTime ?? "",
      invoiceNumber,
      dueDate: dueDateStr,
      payLink,
      crewSize: editableSnapshot?.crewSize ?? job.crewSize ?? undefined,
      numTrucks: editableSnapshot?.numTrucks ?? (job.crewSize ? Math.ceil(job.crewSize / 3) : undefined),
      freeformText: editableSnapshot?.freeformText ?? "",
      suppliesItems: finalSuppliesItems,
    });

    if (!result.success) {
      return res.status(502).json({ success: false, error: "Failed to send invoice email" });
    }

    if (existingInvoice) {
      await db.update(invoicesTable).set({
        remainingBalanceDue: remainingBalance,
        status: "sent",
        sentAt: now,
        updatedAt: now,
      }).where(eq(invoicesTable.id, existingInvoice.id));
    } else {
      await db.update(invoicesTable).set({
        status: "sent",
        sentAt: now,
        updatedAt: now,
      }).where(and(eq(invoicesTable.jobId, job.id), eq(invoicesTable.invoiceNumber, invoiceNumber)));
    }

    const newPaymentStatus = remainingBalance <= 0 ? "paid" : "invoiced";
    await db.update(jobsTable).set({
      invoiceStatus: "sent",
      paymentStatus: newPaymentStatus,
      status: remainingBalance > 0 ? "awaiting_remaining_balance" : job.status,
      remainingBalance,
      updatedAt: now,
    }).where(eq(jobsTable.id, job.id));

    recordTimelineEvent({
      jobId: job.id,
      eventType: "invoice_sent",
      statusLabel: "Invoice Sent",
      visibleToCustomer: true,
      notes: `Invoice ${invoiceNumber} ($${remainingBalance.toFixed(2)} due by ${dueDateStr}) sent to ${email}`,
      createdByUserId: req.user?.userId ?? undefined,
    }).catch(() => {});

    res.json({ success: true, message: "Invoice sent", invoiceNumber });
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
          sql`CASE WHEN ${jobsTable.status} IN ('captain_assigned', 'en_route', 'arrived', 'in_progress', 'at_storage', 'returning', 'delayed', 'finished', 'awaiting_remaining_balance') THEN 1 ELSE 0 END`,
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

router.patch("/invoices/:jobId", requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const [job] = await db.select().from(jobsTable)
      .where(sql`${jobsTable.jobId} = ${String(jobId)} OR CAST(${jobsTable.id} AS TEXT) = ${String(jobId)}`)
      .limit(1);
    if (!job) return res.status(404).json({ error: "Job not found" });

    const {
      laborHours, hourlyRate, travelFee, stairFee, storageFee, packingFee,
      extraCharges, discounts, dueDate, notes: invoiceNotes, items,
      // Task #43 additions
      numTrucks, crewSize, freeformText, suppliesItems,
    } = req.body;

    const validatedSupplies: Array<{ name: string; quantity: number; unitPrice: number; total: number }> = Array.isArray(suppliesItems)
      ? suppliesItems
          .map((it: { name?: string; quantity?: number; unitPrice?: number }) => {
            const qty = Math.max(0, Math.floor(Number(it?.quantity ?? 0)));
            const unit = Math.max(0, Number(it?.unitPrice ?? 0));
            return {
              name: String(it?.name ?? "").slice(0, 120),
              quantity: qty,
              unitPrice: Math.round(unit * 100) / 100,
              total: Math.round(qty * unit * 100) / 100,
            };
          })
          .filter((it) => it.name.length > 0)
      : [];
    const suppliesTotal = validatedSupplies.reduce((sum, it) => sum + it.total, 0);

    const subtotal = ((laborHours ?? job.estimatedHours ?? 0) * (hourlyRate ?? job.hourlyRate ?? 0))
      + (travelFee ?? 0) + (stairFee ?? 0) + (storageFee ?? 0) + (packingFee ?? 0)
      + suppliesTotal;
    const extras = extraCharges ?? job.extraCharges ?? 0;
    // adminDisc is the only discount written back to jobsTable.discounts; the
    // promo (jobs.discountAmount) is a separate, immutable column. Send-invoice
    // recombines the two, so persisting the sum here would double-count.
    const adminDisc = discounts ?? job.discounts ?? 0;
    const promoDisc = job.discountAmount ?? 0;
    const finalTotal = Math.max(0, subtotal + extras - adminDisc - promoDisc);
    const depositApplied = job.depositPaid ?? 0;

    const { remainingBalance: remainingBalanceDue } = await computeTotalPaidAndRemaining(
      job.id, depositApplied, finalTotal);

    const validatedItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }> = Array.isArray(items)
      ? items.map((item: { description?: string; quantity?: number; unitPrice?: number }) => ({
          description: String(item.description ?? ""),
          quantity: Number(item.quantity ?? 1),
          unitPrice: Number(item.unitPrice ?? 0),
          total: Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0),
        }))
      : [];

    const numTrucksValidated = Number.isFinite(Number(numTrucks)) && Number(numTrucks) > 0
      ? Math.max(1, Math.min(10, Math.floor(Number(numTrucks))))
      : (job.crewSize ? Math.ceil(job.crewSize / 3) : 1);

    // Admin-editable crew size for the invoice. We persist it both in the
    // snapshot (for replay/auditing of what the invoice email said) and back
    // onto jobsTable.crewSize so dispatch / captain views stay in sync with
    // the post-move actuals.
    const crewSizeValidated = Number.isFinite(Number(crewSize)) && Number(crewSize) > 0
      ? Math.max(1, Math.min(20, Math.floor(Number(crewSize))))
      : (job.crewSize ?? 0);

    const snapshot = {
      laborHours: laborHours ?? job.estimatedHours ?? 0,
      hourlyRate: hourlyRate ?? job.hourlyRate ?? 0,
      travelFee: travelFee ?? 0,
      stairFee: stairFee ?? 0,
      storageFee: storageFee ?? 0,
      packingFee: packingFee ?? 0,
      notes: invoiceNotes ?? "",
      items: validatedItems,
      // Task #43 additions
      numTrucks: numTrucksValidated,
      crewSize: crewSizeValidated,
      freeformText: typeof freeformText === "string" ? freeformText.slice(0, 4000) : "",
      suppliesItems: validatedSupplies,
      suppliesTotal,
    };

    const [existing] = await db.select().from(invoicesTable)
      .where(eq(invoicesTable.jobId, job.id)).limit(1);

    let invoice;
    if (existing) {
      [invoice] = await db.update(invoicesTable).set({
        subtotal, extraCharges: extras, discounts: adminDisc, finalTotal,
        depositApplied, remainingBalanceDue, dueDate: dueDate ?? existing.dueDate,
        editableSnapshotJson: snapshot, updatedAt: new Date(),
      }).where(eq(invoicesTable.id, existing.id)).returning();
    } else {
      const invoiceNumber = `INV-${job.jobId || job.id}-${Date.now().toString(36).toUpperCase()}`;
      [invoice] = await db.insert(invoicesTable).values({
        jobId: job.id, invoiceNumber, subtotal, extraCharges: extras,
        discounts: adminDisc, finalTotal, depositApplied, remainingBalanceDue,
        dueDate: dueDate ?? null, status: "draft", editableSnapshotJson: snapshot,
      }).returning();
    }

    await db.update(jobsTable).set({
      extraCharges: extras, discounts: adminDisc, finalTotal,
      remainingBalance: remainingBalanceDue,
      // Sync admin-edited crew size back to the job so dispatcher/captain
      // views and downstream invoice emails reflect the same number.
      ...(crewSizeValidated > 0 ? { crewSize: crewSizeValidated } : {}),
      updatedAt: new Date(),
    }).where(eq(jobsTable.id, job.id));

    res.json({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      subtotal: invoice.subtotal,
      extraCharges: invoice.extraCharges,
      discounts: invoice.discounts,
      finalTotal: invoice.finalTotal,
      depositApplied: invoice.depositApplied,
      remainingBalanceDue: invoice.remainingBalanceDue,
      dueDate: invoice.dueDate,
      status: invoice.status,
      editableSnapshot: invoice.editableSnapshotJson,
      createdAt: invoice.createdAt?.toISOString() ?? null,
      updatedAt: invoice.updatedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to save invoice");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invoices/:jobId", requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const [job] = await db.select().from(jobsTable)
      .where(sql`${jobsTable.jobId} = ${String(jobId)} OR CAST(${jobsTable.id} AS TEXT) = ${String(jobId)}`)
      .limit(1);
    if (!job) return res.status(404).json({ error: "Job not found" });

    let quote: typeof quoteRequestsTable.$inferSelect | null = null;
    if (job.quoteId) {
      const [q] = await db.select().from(quoteRequestsTable)
        .where(eq(quoteRequestsTable.id, job.quoteId)).limit(1);
      quote = q ?? null;
    }
    const seededSupplies = seedSuppliesItemsFromQuote(quote);

    const [invoice] = await db.select().from(invoicesTable)
      .where(eq(invoicesTable.jobId, job.id)).limit(1);

    if (!invoice) {
      return res.json({
        id: 0, invoiceNumber: "", subtotal: 0, extraCharges: 0, discounts: 0,
        finalTotal: 0, depositApplied: 0, remainingBalanceDue: 0,
        dueDate: null, status: "none",
        editableSnapshot: {
          numTrucks: job.crewSize ? Math.ceil(job.crewSize / 3) : 1,
          crewSize: job.crewSize ?? 0,
          freeformText: "",
          suppliesItems: seededSupplies,
        },
        sentAt: null, createdAt: null, updatedAt: null,
      });
    }

    // Merge seeded defaults into the existing snapshot when supplies are blank,
    // and surface the admin-edited crew size when present (otherwise fall back
    // to the job's current crew size so the editor isn't blank on first open).
    const existingSnapshot = (invoice.editableSnapshotJson ?? null) as {
      numTrucks?: number;
      crewSize?: number;
      freeformText?: string;
      suppliesItems?: Array<{ name: string; quantity: number; unitPrice: number }>;
    } | null;
    const editableSnapshot = {
      numTrucks: existingSnapshot?.numTrucks ?? (job.crewSize ? Math.ceil(job.crewSize / 3) : 1),
      crewSize: existingSnapshot?.crewSize ?? job.crewSize ?? 0,
      freeformText: existingSnapshot?.freeformText ?? "",
      suppliesItems: (existingSnapshot?.suppliesItems && existingSnapshot.suppliesItems.length > 0)
        ? existingSnapshot.suppliesItems
        : seededSupplies,
    };

    res.json({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      subtotal: invoice.subtotal,
      extraCharges: invoice.extraCharges,
      discounts: invoice.discounts,
      finalTotal: invoice.finalTotal,
      depositApplied: invoice.depositApplied,
      remainingBalanceDue: invoice.remainingBalanceDue,
      dueDate: invoice.dueDate,
      status: invoice.status,
      editableSnapshot,
      sentAt: invoice.sentAt?.toISOString() ?? null,
      createdAt: invoice.createdAt?.toISOString() ?? null,
      updatedAt: invoice.updatedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get invoice");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/revenue", requireAdmin, async (req, res) => {
  try {
    const { from, to, method, status: jobStatus } = req.query;
    const conditions = [];

    if (from) {
      conditions.push(gte(paymentsTable.paidAt, new Date(String(from))));
    }
    if (to) {
      const endDate = new Date(String(to));
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(paymentsTable.paidAt, endDate));
    }
    if (method) {
      conditions.push(eq(paymentsTable.method, String(method)));
    }

    const payments = await db
      .select({
        paymentId: paymentsTable.id,
        jobId: paymentsTable.jobId,
        type: paymentsTable.type,
        method: paymentsTable.method,
        amount: paymentsTable.amount,
        paidAt: paymentsTable.paidAt,
        notes: paymentsTable.notes,
        jobJobId: jobsTable.jobId,
        customer: jobsTable.customer,
        jobStatus: jobsTable.status,
      })
      .from(paymentsTable)
      .leftJoin(jobsTable, eq(paymentsTable.jobId, jobsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(paymentsTable.paidAt));

    let filteredPayments = payments;
    if (jobStatus) {
      filteredPayments = payments.filter(p => p.jobStatus === String(jobStatus));
    }

    const totalRevenue = filteredPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
    const cashRevenue = filteredPayments.filter(p => p.method === "cash").reduce((s, p) => s + (p.amount ?? 0), 0);
    const cardRevenue = filteredPayments.filter(p => p.method === "credit_card" || p.method === "stripe").reduce((s, p) => s + (p.amount ?? 0), 0);
    const depositRevenue = filteredPayments.filter(p => p.type === "deposit").reduce((s, p) => s + (p.amount ?? 0), 0);
    const balanceRevenue = filteredPayments.filter(p => p.type === "remaining_balance").reduce((s, p) => s + (p.amount ?? 0), 0);

    const [receivablesResult] = await db.select({
      total: sum(sql`CASE WHEN ${jobsTable.status} != 'complete' AND ${jobsTable.status} != 'cancelled' THEN COALESCE(${jobsTable.remainingBalance}, 0) ELSE 0 END`),
    }).from(jobsTable);
    const outstandingReceivables = Number(receivablesResult?.total ?? 0);

    const monthlyMap: Record<string, number> = {};
    for (const p of filteredPayments) {
      if (p.paidAt) {
        const key = new Date(p.paidAt).toISOString().slice(0, 7);
        monthlyMap[key] = (monthlyMap[key] ?? 0) + (p.amount ?? 0);
      }
    }
    const monthlyData = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));

    res.json({
      summary: {
        totalRevenue,
        cashRevenue,
        cardRevenue,
        depositRevenue,
        balanceRevenue,
        outstandingReceivables,
        transactionCount: filteredPayments.length,
      },
      monthlyData,
      entries: filteredPayments.map(p => ({
        id: p.paymentId,
        jobId: p.jobJobId ?? p.jobId,
        customer: p.customer ?? "Unknown",
        type: p.type,
        method: p.method,
        amount: p.amount,
        paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : null,
        notes: p.notes,
        jobStatus: p.jobStatus,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get revenue data");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/revenue/export", requireAdmin, async (req, res) => {
  try {
    const { from, to, method, status: jobStatusFilter } = req.query;
    const conditions = [];
    if (from) conditions.push(gte(paymentsTable.paidAt, new Date(String(from))));
    if (to) {
      const endDate = new Date(String(to));
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(paymentsTable.paidAt, endDate));
    }
    if (method) conditions.push(eq(paymentsTable.method, String(method)));

    const payments = await db
      .select({
        paymentId: paymentsTable.id,
        type: paymentsTable.type,
        method: paymentsTable.method,
        amount: paymentsTable.amount,
        paidAt: paymentsTable.paidAt,
        notes: paymentsTable.notes,
        jobJobId: jobsTable.jobId,
        customer: jobsTable.customer,
        jobStatus: jobsTable.status,
      })
      .from(paymentsTable)
      .leftJoin(jobsTable, eq(paymentsTable.jobId, jobsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(paymentsTable.paidAt));

    let filteredPayments = payments;
    if (jobStatusFilter) {
      filteredPayments = payments.filter(p => p.jobStatus === String(jobStatusFilter));
    }

    const sanitizeCsv = (val: string) => {
      let s = val.replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s}"`;
    };

    const header = "Payment ID,Job ID,Customer,Type,Method,Amount,Date,Status,Notes\n";
    const rows = filteredPayments.map(p =>
      [
        p.paymentId,
        p.jobJobId ?? "",
        sanitizeCsv(p.customer ?? ""),
        p.type,
        p.method ?? "",
        (p.amount ?? 0).toFixed(2),
        p.paidAt ? new Date(p.paidAt).toISOString().slice(0, 10) : "",
        p.jobStatus ?? "",
        sanitizeCsv(p.notes ?? ""),
      ].join(",")
    ).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=teemer-revenue-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(header + rows);
  } catch (err) {
    req.log.error({ err }, "Failed to export revenue CSV");
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
        .where(inArray(quoteRequestsTable.id, quoteIds));
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
    const { status, notes, actualHours } = req.body;

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

    if (notes !== undefined && typeof notes === "string" && notes.trim()) {
      const existingNotes = job.notes || "";
      const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
      const newEntry = `[${timestamp}] ${notes.trim()}`;
      updates.notes = existingNotes ? `${existingNotes}\n${newEntry}` : newEntry;
    }

    if (status === "finished") {
      if (typeof actualHours !== "number" || actualHours <= 0) {
        return res.status(400).json({ error: "actualHours is required and must be greater than 0 when finishing a job." });
      }
      const laborHours = actualHours;
      const hourlyRate = job.hourlyRate ?? 0;
      const subtotal = laborHours * hourlyRate;
      const extras = job.extraCharges ?? 0;
      const adminDisc = job.discounts ?? 0;
      const promoDisc = job.discountAmount ?? 0;
      const newFinalTotal = Math.max(0, subtotal + extras - adminDisc - promoDisc);

      updates.estimatedHours = laborHours;
      updates.finalTotal = newFinalTotal;

      const depositApplied = job.depositPaid ?? 0;
      const { remainingBalance: remainingBalanceDue } = await computeTotalPaidAndRemaining(
        job.id, depositApplied, newFinalTotal);
      updates.remainingBalance = remainingBalanceDue;

      const snapshot = {
        laborHours,
        hourlyRate,
        travelFee: 0,
        stairFee: 0,
        storageFee: 0,
        packingFee: 0,
        notes: notes ?? "",
        items: [],
      };

      const [existingInvoice] = await db.select().from(invoicesTable)
        .where(eq(invoicesTable.jobId, job.id)).limit(1);

      if (existingInvoice) {
        await db.update(invoicesTable).set({
          subtotal,
          finalTotal: newFinalTotal,
          depositApplied,
          remainingBalanceDue,
          editableSnapshotJson: snapshot,
          updatedAt: new Date(),
        }).where(eq(invoicesTable.id, existingInvoice.id));
      } else {
        const invoiceNumber = `INV-${job.jobId || job.id}-${Date.now().toString(36).toUpperCase()}`;
        await db.insert(invoicesTable).values({
          jobId: job.id,
          invoiceNumber,
          subtotal,
          extraCharges: extras,
          discounts: disc,
          finalTotal: newFinalTotal,
          depositApplied,
          remainingBalanceDue,
          dueDate: null,
          status: "draft",
          editableSnapshotJson: snapshot,
        });
      }
    }

    if (status === "complete") {
      const pStatus = job.paymentStatus ?? "";
      if (pStatus !== "paid" && pStatus !== "paid_cash") {
        const total = job.finalTotal ?? job.estimatedPayout ?? 0;
        const { remainingBalance: actualOutstanding } = await computeTotalPaidAndRemaining(
          job.id, job.depositPaid ?? 0, total);
        if (actualOutstanding > 0) {
          return res.status(400).json({ error: "Cannot mark complete — outstanding balance must be paid first." });
        }
      }
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
      finished: "Job Finished — Awaiting Payment",
      complete: "Job Complete",
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
