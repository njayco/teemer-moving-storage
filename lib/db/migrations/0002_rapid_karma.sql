CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'move_captain' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"invoice_number" text NOT NULL,
	"subtotal" real DEFAULT 0,
	"extra_charges" real DEFAULT 0,
	"discounts" real DEFAULT 0,
	"final_total" real DEFAULT 0,
	"deposit_applied" real DEFAULT 0,
	"remaining_balance_due" real DEFAULT 0,
	"due_date" text,
	"sent_at" timestamp,
	"status" text DEFAULT 'draft',
	"editable_snapshot_json" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"type" text NOT NULL,
	"method" text,
	"amount" real NOT NULL,
	"reference" text,
	"paid_at" timestamp DEFAULT now(),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "revenue_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"payment_id" integer,
	"category" text NOT NULL,
	"amount" real NOT NULL,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_status_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"status_label" text,
	"visible_to_customer" boolean DEFAULT true,
	"notes" text,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer,
	"quote_id" integer,
	"email_type" text NOT NULL,
	"recipient" text NOT NULL,
	"resend_id" text,
	"status" text DEFAULT 'sent',
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"quote_id" integer,
	"signing_token" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"contract_data_json" json,
	"customer_signature_data" text,
	"customer_signed_at" timestamp,
	"customer_ip_address" text,
	"sent_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contracts_signing_token_unique" UNIQUE("signing_token")
);
--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "commercial_business_type" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "commercial_size_tier" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "service_type" text DEFAULT 'moving';--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "junk_load_size" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "junk_stairs_flights" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "junk_heavy_items_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "junk_construction_debris" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "junk_same_day" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "junk_hazardous_items" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "junk_base_price" real;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "junk_addons_total" real;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "piano_surcharge" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "commercial_adjustment" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "tracking_token" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "quote_id" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "customer_id" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "assigned_captain_id" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "arrival_window" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "origin_address" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "destination_address" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "inventory_json" json;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "box_counts" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "crew_size" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "estimated_hours" real;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "hourly_rate" real;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "estimate_subtotal" real;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "extra_charges" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "discounts" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "final_total" real;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "deposit_paid" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "remaining_balance" real;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "payment_status" text DEFAULT 'unpaid';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "invoice_status" text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;