import { pgTable, text, serial, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  customer: text("customer").notNull(),
  provider: text("provider"),
  pickupLocation: text("pickup_location").notNull(),
  destination: text("destination").notNull(),
  moveType: text("move_type").notNull(),
  dateTime: text("date_time").notNull(),
  estimatedPayout: real("estimated_payout").notNull(),
  specialRequirements: text("special_requirements"),
  jobSize: text("job_size"),
  status: text("status").default("Request Submitted"),
  assignedMover: text("assigned_mover"),
  truckStatus: text("truck_status"),
  eta: text("eta"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
