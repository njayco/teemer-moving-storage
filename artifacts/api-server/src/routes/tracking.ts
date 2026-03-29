import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { quoteRequestsTable, jobsTable, jobStatusEventsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

function formatTrackingResponse(quote: typeof quoteRequestsTable.$inferSelect, events: (typeof jobStatusEventsTable.$inferSelect)[]) {
  const depositPaid = quote.depositAmount ?? 0;
  const totalEstimate = quote.totalEstimate ?? 0;
  const remainingBalance = totalEstimate - depositPaid;

  return {
    quoteId: quote.id,
    customerName: quote.contactName,
    moveDate: quote.moveDate,
    arrivalWindow: quote.arrivalTimeWindow ?? null,
    pickupAddress: quote.pickupAddress || quote.originAddress || "",
    dropoffAddress: quote.dropoffAddress || quote.destinationAddress || "",
    status: quote.status,
    totalEstimate,
    depositPaid,
    remainingBalance,
    paymentStatus: depositPaid > 0 ? (remainingBalance <= 0 ? "paid" : "deposit_paid") : "unpaid",
    timeline: events
      .filter((e) => e.visibleToCustomer)
      .map((e) => ({
        id: e.id,
        eventType: e.eventType,
        statusLabel: e.statusLabel,
        createdAt: e.createdAt?.toISOString() ?? null,
      })),
  };
}

function formatJobTrackingResponse(job: typeof jobsTable.$inferSelect, events: (typeof jobStatusEventsTable.$inferSelect)[]) {
  return {
    jobId: job.jobId,
    customerName: job.customer,
    moveDate: job.dateTime,
    arrivalWindow: job.arrivalWindow ?? null,
    pickupAddress: job.pickupLocation,
    dropoffAddress: job.destination,
    status: job.status,
    totalEstimate: job.finalTotal ?? job.estimatedPayout ?? 0,
    depositPaid: job.depositPaid ?? 0,
    remainingBalance: job.remainingBalance ?? 0,
    paymentStatus: job.paymentStatus ?? "unpaid",
    timeline: events
      .filter((e) => e.visibleToCustomer)
      .map((e) => ({
        id: e.id,
        eventType: e.eventType,
        statusLabel: e.statusLabel,
        createdAt: e.createdAt?.toISOString() ?? null,
      })),
  };
}

router.get("/track/:trackingToken", async (req, res) => {
  try {
    const token = String(req.params.trackingToken);

    const [job] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.trackingToken, token))
      .limit(1);

    if (job) {
      const jobEvents = await db
        .select()
        .from(jobStatusEventsTable)
        .where(eq(jobStatusEventsTable.jobId, job.id))
        .orderBy(desc(jobStatusEventsTable.createdAt));

      let allEvents = [...jobEvents];
      if (job.quoteId) {
        const quoteEvents = await db
          .select()
          .from(jobStatusEventsTable)
          .where(eq(jobStatusEventsTable.jobId, job.quoteId))
          .orderBy(desc(jobStatusEventsTable.createdAt));
        const jobEventIds = new Set(jobEvents.map((e) => e.id));
        for (const qe of quoteEvents) {
          if (!jobEventIds.has(qe.id)) allEvents.push(qe);
        }
      }

      res.json(formatJobTrackingResponse(job, allEvents));
      return;
    }

    const [quote] = await db
      .select()
      .from(quoteRequestsTable)
      .where(eq(quoteRequestsTable.trackingToken, token))
      .limit(1);

    if (!quote) {
      res.status(404).json({ error: "Tracking link not found or expired" });
      return;
    }

    const events = await db
      .select()
      .from(jobStatusEventsTable)
      .where(eq(jobStatusEventsTable.jobId, quote.id))
      .orderBy(desc(jobStatusEventsTable.createdAt));

    res.json(formatTrackingResponse(quote, events));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch tracking data");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/track/lookup", async (req, res) => {
  try {
    const { jobId, email } = req.body;

    if (!jobId || !email) {
      res.status(400).json({ error: "Job ID and email are required" });
      return;
    }

    const jobIdStr = String(jobId);
    const emailStr = String(email).toLowerCase().trim();

    const [job] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.jobId, jobIdStr))
      .limit(1);

    if (job) {
      const [quote] = job.quoteId
        ? await db
            .select()
            .from(quoteRequestsTable)
            .where(and(eq(quoteRequestsTable.id, job.quoteId), eq(quoteRequestsTable.email, emailStr)))
            .limit(1)
        : [null];

      if (!quote) {
        res.status(404).json({ error: "No matching move found. Please check your Job ID and email address." });
        return;
      }

      const jobEvents = await db
        .select()
        .from(jobStatusEventsTable)
        .where(eq(jobStatusEventsTable.jobId, job.id))
        .orderBy(desc(jobStatusEventsTable.createdAt));

      let allEvents = [...jobEvents];
      if (job.quoteId) {
        const quoteEvents = await db
          .select()
          .from(jobStatusEventsTable)
          .where(eq(jobStatusEventsTable.jobId, job.quoteId))
          .orderBy(desc(jobStatusEventsTable.createdAt));
        const jobEventIds = new Set(jobEvents.map((e) => e.id));
        for (const qe of quoteEvents) {
          if (!jobEventIds.has(qe.id)) allEvents.push(qe);
        }
      }

      res.json(formatJobTrackingResponse(job, allEvents));
      return;
    }

    const quoteIdNum = parseInt(jobIdStr.replace(/\D/g, ""), 10);
    if (!isNaN(quoteIdNum)) {
      const [quote] = await db
        .select()
        .from(quoteRequestsTable)
        .where(and(eq(quoteRequestsTable.id, quoteIdNum), eq(quoteRequestsTable.email, emailStr)))
        .limit(1);

      if (quote && (quote.status === "deposit_paid" || quote.status === "booked")) {
        const events = await db
          .select()
          .from(jobStatusEventsTable)
          .where(eq(jobStatusEventsTable.jobId, quote.id))
          .orderBy(desc(jobStatusEventsTable.createdAt));

        res.json(formatTrackingResponse(quote, events));
        return;
      }
    }

    res.status(404).json({ error: "No matching move found. Please check your Job ID and email address." });
  } catch (err) {
    req.log.error({ err }, "Failed to lookup tracking data");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
