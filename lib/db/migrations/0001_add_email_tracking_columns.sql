-- Migration: Add quote_id to email_logs and tracking_token to quote_requests
-- Supports the Resend email integration (Task #7)

ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "quote_id" integer;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "tracking_token" text;
