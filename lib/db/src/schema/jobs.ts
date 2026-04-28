import { pgTable, text, serial, real, timestamp, integer, json } from "drizzle-orm/pg-core";
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

  trackingToken: text("tracking_token"),
  quoteId: integer("quote_id"),
  customerId: integer("customer_id"),
  assignedCaptainId: integer("assigned_captain_id"),
  arrivalWindow: text("arrival_window"),
  originAddress: text("origin_address"),
  destinationAddress: text("destination_address"),
  inventoryJson: json("inventory_json"),
  boxCounts: text("box_counts"),
  crewSize: integer("crew_size"),
  estimatedHours: real("estimated_hours"),
  hourlyRate: real("hourly_rate"),
  estimateSubtotal: real("estimate_subtotal"),
  extraCharges: real("extra_charges").default(0),
  discounts: real("discounts").default(0),
  finalTotal: real("final_total"),
  depositPaid: real("deposit_paid").default(0),
  remainingBalance: real("remaining_balance"),
  paymentStatus: text("payment_status").default("unpaid"),
  invoiceStatus: text("invoice_status").default("none"),
  notes: text("notes"),

  // Booking-flow extras (Task #43)
  parkingInstructions: text("parking_instructions"),
  packingDate: text("packing_date"),
  packingArrivalWindow: text("packing_arrival_window"),
  hasMountedTVs: integer("has_mounted_tvs").default(0),
  mountedTVCount: integer("mounted_tv_count").default(0),
  discountCode: text("discount_code"),
  discountAmount: real("discount_amount").default(0),

  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
