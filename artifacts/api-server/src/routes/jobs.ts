import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { jobsTable, quoteRequestsTable, jobStatusEventsTable } from "@workspace/db/schema";
import { eq, desc, count, sum, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { recordTimelineEvent } from "../lib/timeline";

const router: IRouter = Router();

const MOCK_JOBS = [
  {
    id: "1",
    jobId: "Job820",
    customer: "Sarah Miller",
    provider: undefined,
    pickupLocation: "123 Main St, Long Beach, NY",
    destination: "456 Elm St, Brooklyn, NY",
    moveType: "Residential",
    dateTime: "Thu, Nov 2, 8:00 AM",
    estimatedPayout: 750,
    specialRequirements: "Stairs, Heavy Item (Piano), Delicate Glassware",
    jobSize: "15ft Truck, 2 Movers",
    status: "Request Submitted",
    assignedMover: undefined,
    truckStatus: "Available",
    eta: undefined,
  },
  {
    id: "2",
    jobId: "Job821",
    customer: "John Doe",
    provider: undefined,
    pickupLocation: "789 Oak Ave, Queens, NY",
    destination: "321 Pine St, Manhattan, NY",
    moveType: "Residential",
    dateTime: "Thu, Nov 2, 10:00 AM",
    estimatedPayout: 650,
    specialRequirements: "Fragile Items",
    jobSize: "10ft Truck, 2 Movers",
    status: "Request Submitted",
    assignedMover: undefined,
    truckStatus: "Available",
    eta: undefined,
  },
  {
    id: "3",
    jobId: "Job822",
    customer: "Mike Johnson",
    provider: undefined,
    pickupLocation: "555 Broadway, Manhattan, NY",
    destination: "222 Atlantic Ave, Brooklyn, NY",
    moveType: "Commercial",
    dateTime: "Fri, Nov 3, 9:00 AM",
    estimatedPayout: 1200,
    specialRequirements: "Office Equipment, Servers",
    jobSize: "26ft Truck, 4 Movers",
    status: "Request Submitted",
    assignedMover: undefined,
    truckStatus: "Available",
    eta: undefined,
  },
  {
    id: "4",
    jobId: "Job823",
    customer: "Lisa Chen",
    provider: undefined,
    pickupLocation: "100 Nassau Blvd, Garden City, NY",
    destination: "50 Sunrise Hwy, Lynbrook, NY",
    moveType: "Residential",
    dateTime: "Sat, Nov 4, 8:00 AM",
    estimatedPayout: 550,
    specialRequirements: "None",
    jobSize: "10ft Truck, 2 Movers",
    status: "Request Submitted",
    assignedMover: undefined,
    truckStatus: "Available",
    eta: undefined,
  },
  {
    id: "5",
    jobId: "Job824",
    customer: "David Park",
    provider: undefined,
    pickupLocation: "300 Main St, Babylon, NY",
    destination: "700 Flatbush Ave, Brooklyn, NY",
    moveType: "Residential",
    dateTime: "Sat, Nov 4, 11:00 AM",
    estimatedPayout: 850,
    specialRequirements: "Piano",
    jobSize: "15ft Truck, 3 Movers",
    status: "Request Submitted",
    assignedMover: undefined,
    truckStatus: "Available",
    eta: undefined,
  },
  {
    id: "6",
    jobId: "Job825",
    customer: "Emma Wilson",
    provider: undefined,
    pickupLocation: "88 Sunrise Hwy, Merrick, NY",
    destination: "456 Queens Blvd, Queens, NY",
    moveType: "Long-Distance",
    dateTime: "Sun, Nov 5, 7:00 AM",
    estimatedPayout: 1500,
    specialRequirements: "Antiques, Fine Art",
    jobSize: "26ft Truck, 3 Movers",
    status: "Request Submitted",
    assignedMover: undefined,
    truckStatus: "Available",
    eta: undefined,
  },
];

router.get("/jobs", async (req, res) => {
  try {
    const { area, moveType, status } = req.query;
    let jobs = MOCK_JOBS;
    if (moveType && typeof moveType === "string") {
      jobs = jobs.filter((j) => j.moveType.toLowerCase().includes(moveType.toLowerCase()));
    }
    if (status && typeof status === "string") {
      jobs = jobs.filter((j) => j.status === status);
    }
    res.json(jobs);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch jobs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/jobs", async (req, res) => {
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
        status: "Booking Confirmed",
      })
      .returning();

    res.status(201).json({
      id: String(job.id),
      jobId: job.jobId,
      customer: job.customer,
      pickupLocation: job.pickupLocation,
      destination: job.destination,
      moveType: job.moveType,
      dateTime: job.dateTime,
      estimatedPayout: job.estimatedPayout,
      specialRequirements: job.specialRequirements || undefined,
      jobSize: job.jobSize || undefined,
      status: job.status || "Booking Confirmed",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create job");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/jobs/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const mockJob = MOCK_JOBS.find((j) => j.id === jobId || j.jobId === jobId);
    if (mockJob) {
      return res.json(mockJob);
    }
    const jobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.jobId, jobId));
    if (jobs.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    const job = jobs[0];
    res.json({
      id: String(job.id),
      jobId: job.jobId,
      customer: job.customer,
      pickupLocation: job.pickupLocation,
      destination: job.destination,
      moveType: job.moveType,
      dateTime: job.dateTime,
      estimatedPayout: job.estimatedPayout,
      specialRequirements: job.specialRequirements || undefined,
      jobSize: job.jobSize || undefined,
      status: job.status || "Request Submitted",
      assignedMover: job.assignedMover || undefined,
      truckStatus: job.truckStatus || undefined,
      eta: job.eta || undefined,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get job");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/jobs/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, assignedMover, truckStatus, eta } = req.body;

    const [existing] = await db
      .select({ id: jobsTable.id, status: jobsTable.status })
      .from(jobsTable)
      .where(eq(jobsTable.jobId, String(jobId)))
      .limit(1);

    const [updated] = await db
      .update(jobsTable)
      .set({ status, assignedMover, truckStatus, eta })
      .where(eq(jobsTable.jobId, String(jobId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (existing && status && status !== existing.status) {
      recordTimelineEvent({
        jobId: updated.id,
        eventType: "status_change",
        statusLabel: status,
        visibleToCustomer: true,
        notes: `Status changed from "${existing.status}" to "${status}"`,
      }).catch(() => {});
    }

    if (assignedMover && existing) {
      recordTimelineEvent({
        jobId: updated.id,
        eventType: "captain_assigned",
        statusLabel: "Captain Assigned",
        visibleToCustomer: true,
        notes: `Move captain assigned: ${assignedMover}`,
      }).catch(() => {});
    }

    res.json({
      id: String(updated.id),
      jobId: updated.jobId,
      customer: updated.customer,
      pickupLocation: updated.pickupLocation,
      destination: updated.destination,
      moveType: updated.moveType,
      dateTime: updated.dateTime,
      estimatedPayout: updated.estimatedPayout,
      status: updated.status || status,
      assignedMover: updated.assignedMover || undefined,
      truckStatus: updated.truckStatus || undefined,
      eta: updated.eta || undefined,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update job");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/jobs/:jobId/events", requireAdmin, async (req, res) => {
  try {
    const jobIdParam = String(req.params.jobId);

    const [job] = await db
      .select({ id: jobsTable.id })
      .from(jobsTable)
      .where(eq(jobsTable.jobId, jobIdParam))
      .limit(1);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const events = await db
      .select()
      .from(jobStatusEventsTable)
      .where(eq(jobStatusEventsTable.jobId, job.id))
      .orderBy(desc(jobStatusEventsTable.createdAt));

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
      }))
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
      .where(eq(jobsTable.jobId, jobIdParam))
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
      createdByUserId: (req as any).userId ?? undefined,
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

router.get("/admin/stats", requireAdmin, async (req, res) => {
  try {
    const jobs = await db.select().from(jobsTable).orderBy(desc(jobsTable.createdAt)).limit(10);

    const [quoteCounts] = await db
      .select({
        totalQuotes: count(quoteRequestsTable.id),
        depositCollected: sum(
          sql`CASE WHEN ${quoteRequestsTable.status} IN ('deposit_paid', 'booked') THEN ${quoteRequestsTable.depositAmount} ELSE 0 END`
        ),
        revenuePipeline: sum(quoteRequestsTable.totalEstimate),
        pendingQuotes: sum(
          sql`CASE WHEN ${quoteRequestsTable.status} IN ('quote_requested', 'pending') THEN 1 ELSE 0 END`
        ),
      })
      .from(quoteRequestsTable);

    const stats = {
      totalActiveJobs: 48,
      pendingRequests: Number(quoteCounts?.pendingQuotes ?? 0),
      jobsInTransit: 31,
      completedToday: 19,
      availableCrews: 22,
      availableTrucks: 25,
      revenueToday: 18450,
      totalQuotes: Number(quoteCounts?.totalQuotes ?? 0),
      depositCollected: Number(quoteCounts?.depositCollected ?? 0),
      revenuePipeline: Number(quoteCounts?.revenuePipeline ?? 0),
      weeklyRevenue: [
        { day: "Mon", amount: 12000 },
        { day: "Tue", amount: 15000 },
        { day: "Wed", amount: 11000 },
        { day: "Thu", amount: 18000 },
        { day: "Fri", amount: 22000 },
        { day: "Sat", amount: 16000 },
        { day: "Sun", amount: 18450 },
      ],
      recentJobs: [
        {
          id: "820",
          jobId: "Job820",
          customer: "Sarah Miller",
          provider: "Dispatch Provider",
          pickupLocation: "113 Alarm St",
          destination: "104 Messon St",
          moveType: "Residential",
          dateTime: "2024-11-02",
          estimatedPayout: 18450,
          status: "En Route",
        },
        {
          id: "831",
          jobId: "Job831",
          customer: "Alad Saimerson",
          provider: "Dispatch Provider",
          pickupLocation: "Joe Mars St",
          destination: "105 Messon St",
          moveType: "Commercial",
          dateTime: "2024-11-02",
          estimatedPayout: 18450,
          status: "Booking Confirmed",
        },
        {
          id: "832",
          jobId: "Job832",
          customer: "Alan Miller",
          provider: "Dispatch Provider",
          pickupLocation: "Los Doormons",
          destination: "Los Piegos St",
          moveType: "Residential",
          dateTime: "2024-11-02",
          estimatedPayout: 18450,
          status: "In Transit",
        },
        ...jobs.map((j) => ({
          id: String(j.id),
          jobId: j.jobId,
          customer: j.customer,
          provider: j.provider || undefined,
          pickupLocation: j.pickupLocation,
          destination: j.destination,
          moveType: j.moveType,
          dateTime: j.dateTime,
          estimatedPayout: j.estimatedPayout,
          status: j.status || "Request Submitted",
        })),
      ],
    };
    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Failed to get admin stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
