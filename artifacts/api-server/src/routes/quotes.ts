import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { quoteRequestsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { calculatePricing } from "../lib/pricing-engine.js";
import { recordTimelineEvent } from "../lib/timeline";
import OpenAI from "openai";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapQuoteRow(q: typeof quoteRequestsTable.$inferSelect) {
  return {
    id: String(q.id),
    // Normalize legacy "pending" status (and null) to "quote_requested" so
    // all responses conform to the API enum contract regardless of row age.
    status: (q.status === "pending" || !q.status) ? "quote_requested" : q.status,
    createdAt: q.createdAt?.toISOString() || new Date().toISOString(),
    // Pricing result
    crewSize: q.crewSize,
    hourlyRate: q.hourlyRate,
    estimatedHours: q.estimatedHours,
    laborSubtotal: q.laborSubtotal,
    materialsSubtotal: q.materialsSubtotal,
    totalEstimate: q.totalEstimate,
    depositAmount: q.depositAmount,
    // Legacy compat
    estimatedPriceLow: q.estimatedPriceLow || q.totalEstimate || 0,
    estimatedPriceHigh: q.estimatedPriceHigh || q.totalEstimate || 0,
    // Full quote request data
    quoteRequest: {
      // Contact
      contactName: q.contactName,
      phone: q.phone,
      email: q.email,
      // Move details
      moveDate: q.moveDate,
      arrivalTimeWindow: q.arrivalTimeWindow || undefined,
      pickupAddress: q.pickupAddress || q.originAddress,
      dropoffAddress: q.dropoffAddress || q.destinationAddress,
      secondStop: q.secondStop || undefined,
      storageNeeded: q.storageNeeded || false,
      storageUnitChoice: q.storageUnitChoice || undefined,
      additionalNotes: q.additionalNotes || undefined,
      // Legacy
      moveType: q.moveType,
      residentialOrCommercial: q.residentialOrCommercial || "residential",
      originAddress: q.originAddress,
      destinationAddress: q.destinationAddress,
      moveSize: q.moveSize || undefined,
      numberOfRooms: q.numberOfRooms || undefined,
      packingHelpNeeded: q.packingHelpNeeded || "none",
      specialItems: q.specialItems || undefined,
      // Home size
      numberOfBedrooms: q.numberOfBedrooms ?? 1,
      numberOfLivingRooms: q.numberOfLivingRooms ?? 1,
      isFullyFurnished: q.isFullyFurnished ?? true,
      hasGarage: q.hasGarage ?? false,
      hasOutdoorFurniture: q.hasOutdoorFurniture ?? false,
      hasStairs: q.hasStairs ?? false,
      hasHeavyItems: q.hasHeavyItems ?? false,
      // Inventory
      inventory: (q.inventory as Record<string, number>) || {},
      // Boxes
      boxesAlreadyPacked: q.boxesAlreadyPacked ?? 0,
      needsPackingMaterials: q.needsPackingMaterials ?? false,
      smallBoxes: q.smallBoxes ?? 0,
      mediumBoxes: q.mediumBoxes ?? 0,
    },
  };
}

// ─── GET /quotes ──────────────────────────────────────────────────────────────

router.get("/quotes", async (req, res) => {
  try {
    const quotes = await db
      .select()
      .from(quoteRequestsTable)
      .orderBy(desc(quoteRequestsTable.createdAt));
    res.json(quotes.map(mapQuoteRow));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch quotes");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /quotes/:id ─────────────────────────────────────────────────────────

router.get("/quotes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid quote ID" });
      return;
    }
    const [quote] = await db
      .select()
      .from(quoteRequestsTable)
      .where(eq(quoteRequestsTable.id, id));
    if (!quote) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }
    res.json(mapQuoteRow(quote));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PATCH /quotes/:id/status ────────────────────────────────────────────────

router.patch("/quotes/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid quote ID" });
      return;
    }
    const VALID_STATUSES = ["quote_requested", "deposit_paid", "booked"] as const;
    const { status } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
      return;
    }
    const [updated] = await db
      .update(quoteRequestsTable)
      .set({ status })
      .where(eq(quoteRequestsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }
    res.json(mapQuoteRow(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update quote status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /quotes ─────────────────────────────────────────────────────────────

router.post("/quotes", async (req, res) => {
  try {
    const body = req.body;

    // Run the exact pricing engine
    const pricing = calculatePricing({
      numberOfBedrooms: Number(body.numberOfBedrooms ?? 1),
      numberOfLivingRooms: Number(body.numberOfLivingRooms ?? 1),
      hasGarage: Boolean(body.hasGarage),
      hasOutdoorFurniture: Boolean(body.hasOutdoorFurniture),
      hasStairs: Boolean(body.hasStairs),
      hasHeavyItems: Boolean(body.hasHeavyItems),
      isFullyFurnished: body.isFullyFurnished !== false,
      inventory: (body.inventory as Record<string, number>) || {},
      smallBoxes: Number(body.smallBoxes ?? 0),
      mediumBoxes: Number(body.mediumBoxes ?? 0),
      needsPackingMaterials: Boolean(body.needsPackingMaterials),
    });

    // Determine addresses — support both old and new field names
    const pickupAddress = body.pickupAddress || body.originAddress || "";
    const dropoffAddress = body.dropoffAddress || body.destinationAddress || "";

    const [quote] = await db
      .insert(quoteRequestsTable)
      .values({
        // Contact
        contactName: body.contactName,
        phone: body.phone,
        email: body.email,

        // Move details
        moveDate: body.moveDate,
        arrivalTimeWindow: body.arrivalTimeWindow || null,
        pickupAddress,
        dropoffAddress,
        secondStop: body.secondStop || null,
        storageNeeded: Boolean(body.storageNeeded),
        storageUnitChoice: body.storageUnitChoice || null,
        additionalNotes: body.additionalNotes || null,

        // Legacy fields (mirror new ones)
        moveType: body.moveType || "local",
        residentialOrCommercial: body.residentialOrCommercial || "residential",
        originAddress: pickupAddress,
        destinationAddress: dropoffAddress,
        moveSize: body.moveSize || null,
        numberOfRooms: body.numberOfRooms || null,
        packingHelpNeeded: body.packingHelpNeeded || "none",
        specialItems: body.specialItems || null,

        // Home size
        numberOfBedrooms: Number(body.numberOfBedrooms ?? 1),
        numberOfLivingRooms: Number(body.numberOfLivingRooms ?? 1),
        isFullyFurnished: body.isFullyFurnished !== false,
        hasGarage: Boolean(body.hasGarage),
        hasOutdoorFurniture: Boolean(body.hasOutdoorFurniture),
        hasStairs: Boolean(body.hasStairs),
        hasHeavyItems: Boolean(body.hasHeavyItems),

        // Inventory
        inventory: body.inventory || {},

        // Boxes
        boxesAlreadyPacked: Number(body.boxesAlreadyPacked ?? 0),
        needsPackingMaterials: Boolean(body.needsPackingMaterials),
        smallBoxes: Number(body.smallBoxes ?? 0),
        mediumBoxes: Number(body.mediumBoxes ?? 0),

        // Pricing result
        crewSize: pricing.crewSize,
        hourlyRate: pricing.hourlyRate,
        estimatedHours: pricing.estimatedHours,
        laborSubtotal: pricing.laborSubtotal,
        materialsSubtotal: pricing.materialsSubtotal,
        totalEstimate: pricing.totalEstimate,
        depositAmount: pricing.depositAmount,

        // Legacy compat
        estimatedPriceLow: pricing.totalEstimate,
        estimatedPriceHigh: pricing.totalEstimate,

        status: "quote_requested",
      })
      .returning();

    recordTimelineEvent({
      jobId: quote.id,
      eventType: "quote_created",
      statusLabel: "Quote Requested",
      visibleToCustomer: true,
      notes: `Quote #${quote.id} created for ${quote.contactName}`,
    }).catch(() => {});

    res.status(201).json(mapQuoteRow(quote));
  } catch (err) {
    req.log.error({ err }, "Failed to create quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quotes/estimate-boxes", async (req, res) => {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "AI box estimation is not configured yet. Please enter box counts manually." });
    return;
  }

  const { inventory = {}, numberOfBedrooms = 1, numberOfLivingRooms = 1, isFullyFurnished = true, notes = "" } = req.body as {
    inventory?: Record<string, number>;
    numberOfBedrooms?: number;
    numberOfLivingRooms?: number;
    isFullyFurnished?: boolean;
    notes?: string;
  };

  const inventoryLines = Object.entries(inventory)
    .map(([item, qty]) => `  - ${item}: ${qty}`)
    .join("\n") || "  (no items listed)";

  const notesLine = notes ? `\n- Additional notes from customer: ${notes}` : "";

  const prompt = `You are a moving company estimator. Based on the following move details, estimate how many small boxes (book-sized, ~1.5 cu ft) and medium boxes (mid-size, ~3 cu ft) the customer will need for packing.

Move details:
- Bedrooms: ${numberOfBedrooms}
- Living rooms: ${numberOfLivingRooms}
- Fully furnished: ${isFullyFurnished ? "Yes" : "No"}
- Selected furniture/items:
${inventoryLines}${notesLine}

Rules:
- Consider that each bedroom typically needs 5-10 small boxes and 3-5 medium boxes for closet items, books, and miscellaneous.
- Each living room needs 2-4 small boxes and 1-2 medium boxes.
- Kitchen items usually add 5-10 small boxes and 3-5 medium boxes.
- Heavy items like safes and pianos don't need boxes.
- Round to nearest 5 for cleanliness.

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{"small": <number>, "medium": <number>, "note": "<one-sentence confidence note>"}`;

  try {
    const openai = new OpenAI({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 150,
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = JSON.parse(text) as { small: number; medium: number; note: string };

    if (typeof parsed.small !== "number" || typeof parsed.medium !== "number") {
      throw new Error("Invalid response format");
    }

    res.json({ small: parsed.small, medium: parsed.medium, note: parsed.note ?? "" });
  } catch (err) {
    req.log.error({ err }, "OpenAI estimate-boxes failed");
    res.status(500).json({ error: "Failed to estimate boxes. Please enter counts manually." });
  }
});

router.post("/quotes/:id/checkout", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid quote ID" });
    return;
  }

  try {
    const { getUncachableStripeClient } = await import("../lib/stripe-client.js");
    const stripe = await getUncachableStripeClient();

    const [quote] = await db
      .select()
      .from(quoteRequestsTable)
      .where(eq(quoteRequestsTable.id, id));

    if (!quote) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    if (quote.status === "deposit_paid") {
      res.status(409).json({ error: "Deposit has already been paid for this quote." });
      return;
    }

    const depositCents = Math.round((quote.depositAmount ?? 50) * 100);
    const moveDate = quote.moveDate ?? "TBD";
    const customerName = quote.contactName ?? "Customer";

    const trustedDomain = process.env.REPLIT_DEPLOYMENT === "1"
      ? process.env.REPLIT_DOMAINS?.split(",")[0]
      : process.env.REPLIT_DEV_DOMAIN;
    if (!trustedDomain) {
      res.status(500).json({ error: "Server domain not configured. Please call us to pay the deposit." });
      return;
    }
    const baseUrl = `https://${trustedDomain}`;
    const successUrl = `${baseUrl}/info/quote/confirmation?quoteId=${id}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/info/quote/deposit/${id}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: depositCents,
            product_data: {
              name: "Move Deposit — Teemer Moving & Storage",
              description: `Move date: ${moveDate} · Customer: ${customerName} · Quote #${id}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { quoteId: String(id) },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    req.log.error({ err }, "Stripe checkout session creation failed");
    res.status(500).json({ error: "Failed to create payment session. Please call us to pay the deposit." });
  }
});

export default router;
