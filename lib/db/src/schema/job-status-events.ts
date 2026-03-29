import { pgTable, text, serial, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobStatusEventsTable = pgTable("job_status_events", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  eventType: text("event_type").notNull(),
  statusLabel: text("status_label"),
  visibleToCustomer: boolean("visible_to_customer").default(true),
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobStatusEventSchema = createInsertSchema(jobStatusEventsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertJobStatusEvent = z.infer<typeof insertJobStatusEventSchema>;
export type JobStatusEvent = typeof jobStatusEventsTable.$inferSelect;
