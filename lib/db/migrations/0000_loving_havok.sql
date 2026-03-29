-- Migration: Add enriched quote fields to existing quote_requests table
-- Adds new columns for the full quote wizard (home size, inventory, pricing results).
-- All new columns are nullable so existing rows are unaffected.

ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "arrival_time_window" text;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "pickup_address" text;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "dropoff_address" text;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "second_stop" text;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "number_of_bedrooms" integer DEFAULT 1;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "number_of_living_rooms" integer DEFAULT 1;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "is_fully_furnished" boolean DEFAULT true;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "has_garage" boolean DEFAULT false;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "has_outdoor_furniture" boolean DEFAULT false;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "has_stairs" boolean DEFAULT false;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "has_heavy_items" boolean DEFAULT false;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "inventory" json;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "boxes_already_packed" integer DEFAULT 0;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "needs_packing_materials" boolean DEFAULT false;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "small_boxes" integer DEFAULT 0;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "medium_boxes" integer DEFAULT 0;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "storage_unit_choice" text;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "crew_size" integer;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "hourly_rate" real;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "estimated_hours" real;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "labor_subtotal" real;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "materials_subtotal" real;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "deposit_amount" real;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "total_estimate" real;

-- Add defaults to existing address columns so new wizard inserts can omit them.
ALTER TABLE "quote_requests" ALTER COLUMN "origin_address" SET DEFAULT '';
ALTER TABLE "quote_requests" ALTER COLUMN "destination_address" SET DEFAULT '';
ALTER TABLE "quote_requests" ALTER COLUMN "move_type" SET DEFAULT 'local';

-- Update status default from legacy 'pending' to 'quote_requested'.
ALTER TABLE "quote_requests" ALTER COLUMN "status" SET DEFAULT 'quote_requested';

-- Normalize legacy status values so all rows conform to the API enum contract.
UPDATE "quote_requests" SET "status" = 'quote_requested' WHERE "status" = 'pending' OR "status" IS NULL;
