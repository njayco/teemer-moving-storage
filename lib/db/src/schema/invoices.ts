import { pgTable, text, serial, integer, real, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  subtotal: real("subtotal").default(0),
  extraCharges: real("extra_charges").default(0),
  discounts: real("discounts").default(0),
  finalTotal: real("final_total").default(0),
  depositApplied: real("deposit_applied").default(0),
  remainingBalanceDue: real("remaining_balance_due").default(0),
  dueDate: text("due_date"),
  sentAt: timestamp("sent_at"),
  status: text("status").default("draft"),
  paidAt: timestamp("paid_at"),
  editableSnapshotJson: json("editable_snapshot_json"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
