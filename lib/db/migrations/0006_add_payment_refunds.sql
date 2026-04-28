CREATE TABLE IF NOT EXISTS "payment_refunds" (
        "id" serial PRIMARY KEY NOT NULL,
        "payment_id" integer NOT NULL,
        "stripe_refund_id" text,
        "stripe_charge_id" text,
        "amount" real NOT NULL,
        "reason" text,
        "status" text DEFAULT 'succeeded' NOT NULL,
        "created_by_user_id" integer,
        "notes" text,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_stripe_refund_unique" ON "payment_refunds" ("stripe_refund_id");
