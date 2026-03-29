import { pgTable, serial, text, timestamp, unique, real, integer, json, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const contacts = pgTable("contacts", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	phone: text().notNull(),
	email: text().notNull(),
	moveDate: text("move_date"),
	moveType: text("move_type"),
	origin: text(),
	destination: text(),
	message: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const jobs = pgTable("jobs", {
	id: serial().primaryKey().notNull(),
	jobId: text("job_id").notNull(),
	customer: text().notNull(),
	provider: text(),
	pickupLocation: text("pickup_location").notNull(),
	destination: text().notNull(),
	moveType: text("move_type").notNull(),
	dateTime: text("date_time").notNull(),
	estimatedPayout: real("estimated_payout").notNull(),
	specialRequirements: text("special_requirements"),
	jobSize: text("job_size"),
	status: text().default('Request Submitted'),
	assignedMover: text("assigned_mover"),
	truckStatus: text("truck_status"),
	eta: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	trackingToken: text("tracking_token"),
	quoteId: integer("quote_id"),
	customerId: integer("customer_id"),
	assignedCaptainId: integer("assigned_captain_id"),
	arrivalWindow: text("arrival_window"),
	originAddress: text("origin_address"),
	destinationAddress: text("destination_address"),
	inventoryJson: json("inventory_json"),
	boxCounts: text("box_counts"),
	crewSize: integer("crew_size"),
	estimatedHours: real("estimated_hours"),
	hourlyRate: real("hourly_rate"),
	estimateSubtotal: real("estimate_subtotal"),
	extraCharges: real("extra_charges").default(0),
	discounts: real().default(0),
	finalTotal: real("final_total"),
	depositPaid: real("deposit_paid").default(0),
	remainingBalance: real("remaining_balance"),
	paymentStatus: text("payment_status").default('unpaid'),
	invoiceStatus: text("invoice_status").default('none'),
	notes: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
}, (table) => [
	unique("jobs_job_id_unique").on(table.jobId),
]);

export const quoteRequests = pgTable("quote_requests", {
	id: serial().primaryKey().notNull(),
	moveType: text("move_type").default('local').notNull(),
	residentialOrCommercial: text("residential_or_commercial").default('residential'),
	originAddress: text("origin_address").default(').notNull(),
	destinationAddress: text("destination_address").default(').notNull(),
	moveDate: text("move_date").notNull(),
	moveSize: text("move_size"),
	numberOfRooms: integer("number_of_rooms"),
	packingHelpNeeded: text("packing_help_needed").default('none'),
	specialItems: text("special_items"),
	storageNeeded: boolean("storage_needed").default(false),
	contactName: text("contact_name").notNull(),
	phone: text().notNull(),
	email: text().notNull(),
	additionalNotes: text("additional_notes"),
	estimatedPriceLow: real("estimated_price_low"),
	estimatedPriceHigh: real("estimated_price_high"),
	status: text().default('quote_requested'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	arrivalTimeWindow: text("arrival_time_window"),
	pickupAddress: text("pickup_address"),
	dropoffAddress: text("dropoff_address"),
	secondStop: text("second_stop"),
	numberOfBedrooms: integer("number_of_bedrooms").default(1),
	numberOfLivingRooms: integer("number_of_living_rooms").default(1),
	isFullyFurnished: boolean("is_fully_furnished").default(true),
	hasGarage: boolean("has_garage").default(false),
	hasOutdoorFurniture: boolean("has_outdoor_furniture").default(false),
	hasStairs: boolean("has_stairs").default(false),
	hasHeavyItems: boolean("has_heavy_items").default(false),
	inventory: json(),
	boxesAlreadyPacked: integer("boxes_already_packed").default(0),
	needsPackingMaterials: boolean("needs_packing_materials").default(false),
	smallBoxes: integer("small_boxes").default(0),
	mediumBoxes: integer("medium_boxes").default(0),
	storageUnitChoice: text("storage_unit_choice"),
	crewSize: integer("crew_size"),
	hourlyRate: real("hourly_rate"),
	estimatedHours: real("estimated_hours"),
	laborSubtotal: real("labor_subtotal"),
	materialsSubtotal: real("materials_subtotal"),
	depositAmount: real("deposit_amount"),
	totalEstimate: real("total_estimate"),
	trackingToken: text("tracking_token"),
});

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	role: text().default('move_captain').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const customers = pgTable("customers", {
	id: serial().primaryKey().notNull(),
	fullName: text("full_name").notNull(),
	email: text().notNull(),
	phone: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const invoices = pgTable("invoices", {
	id: serial().primaryKey().notNull(),
	jobId: serial("job_id").notNull(),
	invoiceNumber: text("invoice_number").notNull(),
	subtotal: real().default(0),
	extraCharges: real("extra_charges").default(0),
	discounts: real().default(0),
	finalTotal: real("final_total").default(0),
	depositApplied: real("deposit_applied").default(0),
	remainingBalanceDue: real("remaining_balance_due").default(0),
	dueDate: text("due_date"),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	status: text().default('draft'),
	editableSnapshotJson: json("editable_snapshot_json"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("invoices_invoice_number_unique").on(table.invoiceNumber),
]);

export const payments = pgTable("payments", {
	id: serial().primaryKey().notNull(),
	jobId: serial("job_id").notNull(),
	type: text().notNull(),
	method: text(),
	amount: real().notNull(),
	reference: text(),
	paidAt: timestamp("paid_at", { mode: 'string' }).defaultNow(),
	notes: text(),
});

export const revenueLedger = pgTable("revenue_ledger", {
	id: serial().primaryKey().notNull(),
	jobId: serial("job_id").notNull(),
	paymentId: serial("payment_id"),
	category: text().notNull(),
	amount: real().notNull(),
	recordedAt: timestamp("recorded_at", { mode: 'string' }).defaultNow(),
});

export const jobStatusEvents = pgTable("job_status_events", {
	id: serial().primaryKey().notNull(),
	jobId: integer("job_id").notNull(),
	eventType: text("event_type").notNull(),
	statusLabel: text("status_label"),
	visibleToCustomer: boolean("visible_to_customer").default(true),
	notes: text(),
	createdByUserId: integer("created_by_user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const emailLogs = pgTable("email_logs", {
	id: serial().primaryKey().notNull(),
	jobId: integer("job_id"),
	emailType: text("email_type").notNull(),
	recipient: text().notNull(),
	resendId: text("resend_id"),
	status: text().default('sent'),
	sentAt: timestamp("sent_at", { mode: 'string' }).defaultNow(),
	quoteId: integer("quote_id"),
});
