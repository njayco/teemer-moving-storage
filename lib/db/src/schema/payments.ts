import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  type: text("type").notNull(),
  method: text("method"),
  amount: real("amount").notNull(),
  reference: text("reference"),
  paidAt: timestamp("paid_at").defaultNow(),
  notes: text("notes"),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true,
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
