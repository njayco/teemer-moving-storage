import { pgTable, text, serial, timestamp, integer, json } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs";

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id),
  quoteId: integer("quote_id"),
  signingToken: text("signing_token").notNull().unique(),
  status: text("status").notNull().default("sent"),
  contractDataJson: json("contract_data_json").$type<Record<string, unknown>>(),
  customerSignatureData: text("customer_signature_data"),
  customerSignedAt: timestamp("customer_signed_at"),
  customerIpAddress: text("customer_ip_address"),
  sentAt: timestamp("sent_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Contract = typeof contractsTable.$inferSelect;
export type InsertContract = typeof contractsTable.$inferInsert;
