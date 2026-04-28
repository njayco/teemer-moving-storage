import { pgTable, text, serial, real, integer, boolean, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const discountCodesTable = pgTable(
  "discount_codes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    type: text("type").notNull(),
    value: real("value").notNull(),
    label: text("label").notNull(),
    active: boolean("active").notNull().default(true),
    expiresAt: timestamp("expires_at"),
    usageLimit: integer("usage_limit"),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    check("discount_codes_type_check", sql`${table.type} IN ('percent', 'fixed')`),
    check("discount_codes_value_positive", sql`${table.value} > 0`),
    check("discount_codes_percent_max", sql`${table.type} <> 'percent' OR ${table.value} <= 100`),
    check("discount_codes_usage_limit_positive", sql`${table.usageLimit} IS NULL OR ${table.usageLimit} > 0`),
    check("discount_codes_usage_count_nonneg", sql`${table.usageCount} >= 0`),
  ],
);

export type DiscountCode = typeof discountCodesTable.$inferSelect;
export type InsertDiscountCode = typeof discountCodesTable.$inferInsert;
