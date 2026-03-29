import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const revenueLedgerTable = pgTable("revenue_ledger", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  paymentId: integer("payment_id"),
  category: text("category").notNull(),
  amount: real("amount").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

export const insertRevenueLedgerSchema = createInsertSchema(revenueLedgerTable).omit({
  id: true,
});

export type InsertRevenueLedger = z.infer<typeof insertRevenueLedgerSchema>;
export type RevenueLedger = typeof revenueLedgerTable.$inferSelect;
