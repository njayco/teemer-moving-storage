import { pgTable, text, serial, integer, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentRefundsTable = pgTable(
  "payment_refunds",
  {
    id: serial("id").primaryKey(),
    paymentId: integer("payment_id").notNull(),
    stripeRefundId: text("stripe_refund_id"),
    stripeChargeId: text("stripe_charge_id"),
    amount: real("amount").notNull(),
    reason: text("reason"),
    status: text("status").notNull().default("succeeded"),
    createdByUserId: integer("created_by_user_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    paymentRefundsStripeRefundUnique: uniqueIndex("payment_refunds_stripe_refund_unique").on(
      t.stripeRefundId,
    ),
  }),
);

export const insertPaymentRefundSchema = createInsertSchema(paymentRefundsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertPaymentRefund = z.infer<typeof insertPaymentRefundSchema>;
export type PaymentRefund = typeof paymentRefundsTable.$inferSelect;
