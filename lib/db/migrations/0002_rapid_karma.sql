ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "service_type" text DEFAULT 'moving';--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "junk_load_size" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "junk_stairs_flights" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "junk_heavy_items_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "junk_construction_debris" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "junk_same_day" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "junk_hazardous_items" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "junk_base_price" real;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "junk_addons_total" real;
