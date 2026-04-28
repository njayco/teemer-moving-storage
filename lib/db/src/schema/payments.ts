import { pgTable, text, serial, integer, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentsTable = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id"),
    customerId: integer("customer_id"),
    paymentRequestId: integer("payment_request_id"),
    type: text("type").notNull(),
    method: text("method"),
    amount: real("amount").notNull(),
    reference: text("reference"),
    confirmationNumber: text("confirmation_number"),
    paidAt: timestamp("paid_at").defaultNow(),
    notes: text("notes"),
  },
  (t) => ({
    paymentsConfirmationUnique: uniqueIndex("payments_confirmation_unique").on(t.confirmationNumber),
  }),
);

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true,
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
