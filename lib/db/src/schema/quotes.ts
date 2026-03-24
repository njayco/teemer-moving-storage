import { pgTable, text, serial, boolean, real, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quoteRequestsTable = pgTable("quote_requests", {
  id: serial("id").primaryKey(),
  moveType: text("move_type").notNull(),
  residentialOrCommercial: text("residential_or_commercial").default("residential"),
  originAddress: text("origin_address").notNull(),
  destinationAddress: text("destination_address").notNull(),
  moveDate: text("move_date").notNull(),
  moveSize: text("move_size"),
  numberOfRooms: integer("number_of_rooms"),
  packingHelpNeeded: text("packing_help_needed").default("none"),
  specialItems: text("special_items"),
  storageNeeded: boolean("storage_needed").default(false),
  contactName: text("contact_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  additionalNotes: text("additional_notes"),
  estimatedPriceLow: real("estimated_price_low"),
  estimatedPriceHigh: real("estimated_price_high"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQuoteRequestSchema = createInsertSchema(quoteRequestsTable).omit({
  id: true,
  createdAt: true,
  estimatedPriceLow: true,
  estimatedPriceHigh: true,
  status: true,
});

export type InsertQuoteRequest = z.infer<typeof insertQuoteRequestSchema>;
export type QuoteRequest = typeof quoteRequestsTable.$inferSelect;
