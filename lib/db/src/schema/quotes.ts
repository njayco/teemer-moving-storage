import { pgTable, text, serial, boolean, real, timestamp, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quoteRequestsTable = pgTable("quote_requests", {
  id: serial("id").primaryKey(),

  // Contact info
  contactName: text("contact_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),

  // Move details
  moveDate: text("move_date").notNull(),
  arrivalTimeWindow: text("arrival_time_window"),
  pickupAddress: text("pickup_address"),
  dropoffAddress: text("dropoff_address"),
  secondStop: text("second_stop"),
  storageNeeded: boolean("storage_needed").default(false),
  additionalNotes: text("additional_notes"),

  // Legacy fields (kept for backward compat)
  moveType: text("move_type").notNull().default("local"),
  residentialOrCommercial: text("residential_or_commercial").default("residential"),
  originAddress: text("origin_address").notNull().default(""),
  destinationAddress: text("destination_address").notNull().default(""),
  moveSize: text("move_size"),
  numberOfRooms: integer("number_of_rooms"),
  packingHelpNeeded: text("packing_help_needed").default("none"),
  specialItems: text("special_items"),

  // Home size
  numberOfBedrooms: integer("number_of_bedrooms").default(1),
  numberOfLivingRooms: integer("number_of_living_rooms").default(1),
  isFullyFurnished: boolean("is_fully_furnished").default(true),
  hasGarage: boolean("has_garage").default(false),
  hasOutdoorFurniture: boolean("has_outdoor_furniture").default(false),
  hasStairs: boolean("has_stairs").default(false),
  hasHeavyItems: boolean("has_heavy_items").default(false),

  // Inventory (JSON: { [itemName: string]: number })
  inventory: json("inventory").$type<Record<string, number>>(),

  // Box estimate
  boxesAlreadyPacked: integer("boxes_already_packed").default(0),
  needsPackingMaterials: boolean("needs_packing_materials").default(false),
  smallBoxes: integer("small_boxes").default(0),
  mediumBoxes: integer("medium_boxes").default(0),

  // Storage choice
  storageUnitChoice: text("storage_unit_choice"),

  // Calculated pricing
  crewSize: integer("crew_size"),
  hourlyRate: real("hourly_rate"),
  estimatedHours: real("estimated_hours"),
  laborSubtotal: real("labor_subtotal"),
  materialsSubtotal: real("materials_subtotal"),
  depositAmount: real("deposit_amount"),
  totalEstimate: real("total_estimate"),

  // Legacy price fields (kept for compatibility)
  estimatedPriceLow: real("estimated_price_low"),
  estimatedPriceHigh: real("estimated_price_high"),

  // Tracking
  trackingToken: text("tracking_token"),

  // Status: quote_requested | deposit_paid | booked | pending (legacy)
  status: text("status").default("quote_requested"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQuoteRequestSchema = createInsertSchema(quoteRequestsTable).omit({
  id: true,
  createdAt: true,
  estimatedPriceLow: true,
  estimatedPriceHigh: true,
  status: true,
  crewSize: true,
  hourlyRate: true,
  estimatedHours: true,
  laborSubtotal: true,
  materialsSubtotal: true,
  depositAmount: true,
  totalEstimate: true,
});

export type InsertQuoteRequest = z.infer<typeof insertQuoteRequestSchema>;
export type QuoteRequest = typeof quoteRequestsTable.$inferSelect;
