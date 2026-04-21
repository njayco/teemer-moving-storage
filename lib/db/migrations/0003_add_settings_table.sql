CREATE TABLE IF NOT EXISTS "settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" text NOT NULL UNIQUE,
  "value" text NOT NULL,
  "updated_at" timestamp DEFAULT now()
);
