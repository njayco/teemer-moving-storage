ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "mounted_tv_fee" real DEFAULT 0;

-- Intentionally NOT backfilling existing rows. Quotes created before
-- Task #45 had no per-TV fee in their `total_estimate`; silently setting
-- `mounted_tv_fee = mounted_tv_count * 50` would imply a charge that was
-- never quoted to the customer, and would make the invoice editor
-- pre-populate a line item the customer never agreed to. Legacy rows
-- keep `mounted_tv_fee = 0`; the read paths treat that as "no fee was
-- charged" and skip the line item everywhere it would otherwise appear.
