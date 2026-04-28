ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "discount_redeemed_at" timestamp;
--> statement-breakpoint
CREATE TABLE "discount_codes" (
        "id" serial PRIMARY KEY NOT NULL,
        "code" text NOT NULL,
        "type" text NOT NULL,
        "value" real NOT NULL,
        "label" text NOT NULL,
        "active" boolean DEFAULT true NOT NULL,
        "expires_at" timestamp,
        "usage_limit" integer,
        "usage_count" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "discount_codes_code_unique" UNIQUE("code"),
        CONSTRAINT "discount_codes_type_check" CHECK ("discount_codes"."type" IN ('percent', 'fixed')),
        CONSTRAINT "discount_codes_value_positive" CHECK ("discount_codes"."value" > 0),
        CONSTRAINT "discount_codes_percent_max" CHECK ("discount_codes"."type" <> 'percent' OR "discount_codes"."value" <= 100),
        CONSTRAINT "discount_codes_usage_limit_positive" CHECK ("discount_codes"."usage_limit" IS NULL OR "discount_codes"."usage_limit" > 0),
        CONSTRAINT "discount_codes_usage_count_nonneg" CHECK ("discount_codes"."usage_count" >= 0)
);
--> statement-breakpoint
INSERT INTO "discount_codes" ("code", "type", "value", "label", "active")
VALUES ('SANDV10', 'percent', 10, 'SANDV10 — 10% off (Seniors & Veterans)', true)
ON CONFLICT ("code") DO NOTHING;
