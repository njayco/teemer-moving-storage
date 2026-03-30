import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { quoteRequestsTable, jobsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { calculatePricing, calculateJunkRemovalPricing } from "../lib/pricing-engine.js";
import { recordTimelineEvent } from "../lib/timeline";
import { sendBookingConfirmationEmail } from "../lib/email-service";
import { logger } from "../lib/logger";
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
    pianoSurcharge: q.pianoSurcharge ?? 0,
    commercialAdjustment: q.commercialAdjustment ?? 0,
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
      // Commercial
      isCommercial: q.residentialOrCommercial === "commercial" || !!(q.commercialBusinessType || q.commercialSizeTier),
      commercialBusinessType: q.commercialBusinessType || undefined,
      commercialSizeTier: q.commercialSizeTier || undefined,
      // Service type + junk removal echo
      serviceType: q.serviceType || "moving",
      junkLoadSize: q.junkLoadSize || undefined,
      junkStairsFlights: q.junkStairsFlights ?? undefined,
      junkHeavyItemsCount: q.junkHeavyItemsCount ?? undefined,
      junkConstructionDebris: q.junkConstructionDebris ?? undefined,
      junkSameDay: q.junkSameDay ?? undefined,
      junkHazardousItems: q.junkHazardousItems ?? undefined,
    },
    serviceType: q.serviceType || "moving",
    junkLoadSize: q.junkLoadSize || undefined,
    junkStairsFlights: q.junkStairsFlights ?? 0,
    junkHeavyItemsCount: q.junkHeavyItemsCount ?? 0,
    junkConstructionDebris: q.junkConstructionDebris ?? false,
    junkSameDay: q.junkSameDay ?? false,
    junkHazardousItems: q.junkHazardousItems ?? false,
    junkBasePrice: q.junkBasePrice ?? undefined,
    junkAddonsTotal: q.junkAddonsTotal ?? undefined,
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
    if (status === "booked") {
      const [existingJob] = await db
        .select()
        .from(jobsTable)
        .where(eq(jobsTable.quoteId, id))
        .limit(1);

      const result = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(quoteRequestsTable)
          .set({ status })
          .where(eq(quoteRequestsTable.id, id))
          .returning();
        if (!updated) return null;

        let createdJob = null;
        if (!existingJob) {
          const jobId = `Job${Date.now().toString().slice(-6)}`;
          const pickupAddr = updated.pickupAddress || updated.originAddress || "";
          const dropoffAddr = updated.dropoffAddress || updated.destinationAddress || "";
          const totalEstimate = updated.totalEstimate ?? 0;
          const depositPaid = updated.depositAmount ?? 0;
          const remainingBalance = totalEstimate - depositPaid;

          [createdJob] = await tx
            .insert(jobsTable)
            .values({
              jobId,
              customer: updated.contactName,
              pickupLocation: pickupAddr,
              destination: dropoffAddr,
              moveType: updated.moveType || "local",
              dateTime: updated.moveDate,
              estimatedPayout: totalEstimate,
              specialRequirements: updated.additionalNotes || undefined,
              jobSize: updated.moveSize || undefined,
              status: "scheduled",
              quoteId: id,
              trackingToken: updated.trackingToken || undefined,
              arrivalWindow: updated.arrivalTimeWindow || undefined,
              originAddress: pickupAddr,
              destinationAddress: dropoffAddr,
              inventoryJson: updated.inventory || undefined,
              boxCounts: updated.smallBoxes || updated.mediumBoxes
                ? `Small: ${updated.smallBoxes ?? 0}, Medium: ${updated.mediumBoxes ?? 0}`
                : undefined,
              crewSize: updated.crewSize || undefined,
              estimatedHours: updated.estimatedHours || undefined,
              hourlyRate: updated.hourlyRate || undefined,
              estimateSubtotal: updated.laborSubtotal || undefined,
              finalTotal: totalEstimate || undefined,
              depositPaid,
              remainingBalance,
            })
            .returning();
        }

        return { updated, createdJob };
      });

      if (!result || !result.updated) {
        res.status(404).json({ error: "Quote not found" });
        return;
      }

      const { updated, createdJob } = result;

      if (createdJob) {
        logger.info({ jobId: createdJob.id, quoteId: id }, "Auto-created job from booked quote");

        recordTimelineEvent({
          jobId: createdJob.id,
          eventType: "job_created",
          statusLabel: "Job Booked",
          visibleToCustomer: true,
          notes: `Job auto-created from quote #${id} — status set to booked`,
        }).catch(() => {});
      }

      const baseUrl = process.env.APP_BASE_URL
        || (process.env.REPLIT_DEPLOYMENT === "1"
          ? `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`
          : process.env.REPLIT_DEV_DOMAIN
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : "https://teemer.com");
      const trackingUrl = `${baseUrl}/track/${id}/${updated.trackingToken ?? ""}`;

      sendBookingConfirmationEmail({
        customerName: updated.contactName ?? "Customer",
        email: updated.email ?? "",
        quoteId: id,
        moveDate: updated.moveDate ?? "TBD",
        arrivalWindow: updated.arrivalTimeWindow ?? undefined,
        pickupAddress: updated.pickupAddress || updated.originAddress || "",
        dropoffAddress: updated.dropoffAddress || updated.destinationAddress || "",
        crewSize: updated.crewSize ?? undefined,
        estimatedHours: updated.estimatedHours ?? undefined,
        trackingUrl,
      }).catch((err) => logger.error({ err }, "Failed to send booking confirmation email"));

      res.json(mapQuoteRow(updated));
    } else {
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
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update quote status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /quotes ─────────────────────────────────────────────────────────────

router.post("/quotes", async (req, res) => {
  try {
    const body = req.body;
    const serviceType = body.serviceType === "junk_removal" ? "junk_removal" : "moving";
    const isJunkRemoval = serviceType === "junk_removal";

    const pickupAddress = body.pickupAddress || body.originAddress || "";
    const dropoffAddress = body.dropoffAddress || body.destinationAddress || "";

    let totalEstimate: number;
    let depositAmount: number;
    let pricingFields: Record<string, unknown>;

    const safeInt = (v: unknown, max = 99) => {
      const n = Math.floor(Number(v));
      return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
    };
    const validLoadSizes = ["small", "medium", "large", "full_truck"] as const;
    const junkFields = {
      loadSize: validLoadSizes.includes(body.junkLoadSize as typeof validLoadSizes[number])
        ? (body.junkLoadSize as typeof validLoadSizes[number])
        : "small",
      stairsFlights: safeInt(body.junkStairsFlights, 10),
      heavyItemsCount: safeInt(body.junkHeavyItemsCount, 20),
      constructionDebris: Boolean(body.junkConstructionDebris),
      sameDay: Boolean(body.junkSameDay),
      hazardousItems: Boolean(body.junkHazardousItems),
    };

    if (isJunkRemoval) {
      const junkPricing = calculateJunkRemovalPricing(junkFields);
      totalEstimate = junkPricing.totalEstimate;
      depositAmount = junkPricing.depositAmount;
      pricingFields = {
        crewSize: null,
        hourlyRate: null,
        estimatedHours: null,
        laborSubtotal: null,
        materialsSubtotal: null,
        pianoSurcharge: 0,
        commercialAdjustment: 0,
        totalEstimate: junkPricing.totalEstimate,
        depositAmount: junkPricing.depositAmount,
        junkBasePrice: junkPricing.basePrice,
        junkAddonsTotal: junkPricing.addonsTotal,
      };
    } else {
      const isCommercial = Boolean(body.isCommercial) || body.residentialOrCommercial === "commercial";
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
        pianoType: body.pianoType || undefined,
        pianoFloor: body.pianoFloor || undefined,
        isCommercial,
        commercialBusinessType: body.commercialBusinessType || undefined,
        commercialSizeTier: body.commercialSizeTier || undefined,
      });
      totalEstimate = pricing.totalEstimate;
      depositAmount = pricing.depositAmount;
      pricingFields = {
        crewSize: pricing.crewSize,
        hourlyRate: pricing.hourlyRate,
        estimatedHours: pricing.estimatedHours,
        laborSubtotal: pricing.laborSubtotal,
        materialsSubtotal: pricing.materialsSubtotal,
        pianoSurcharge: pricing.pianoSurcharge,
        commercialAdjustment: pricing.commercialAdjustment,
        totalEstimate: pricing.totalEstimate,
        depositAmount: pricing.depositAmount,
        junkBasePrice: null,
        junkAddonsTotal: null,
      };
    }

    const isCommercial = !isJunkRemoval && (Boolean(body.isCommercial) || body.residentialOrCommercial === "commercial");

    const [quote] = await db
      .insert(quoteRequestsTable)
      .values({
        contactName: body.contactName,
        phone: body.phone,
        email: body.email,

        moveDate: body.moveDate,
        arrivalTimeWindow: body.arrivalTimeWindow || null,
        pickupAddress,
        dropoffAddress,
        secondStop: body.secondStop || null,
        storageNeeded: Boolean(body.storageNeeded),
        storageUnitChoice: body.storageUnitChoice || null,
        additionalNotes: body.additionalNotes || null,

        moveType: body.moveType || "local",
        residentialOrCommercial: isCommercial ? "commercial" : (body.residentialOrCommercial || "residential"),
        originAddress: pickupAddress,
        destinationAddress: dropoffAddress,
        moveSize: body.moveSize || null,
        numberOfRooms: body.numberOfRooms || null,
        packingHelpNeeded: body.packingHelpNeeded || "none",
        specialItems: body.specialItems || null,

        numberOfBedrooms: Number(body.numberOfBedrooms ?? 1),
        numberOfLivingRooms: Number(body.numberOfLivingRooms ?? 1),
        isFullyFurnished: body.isFullyFurnished !== false,
        hasGarage: Boolean(body.hasGarage),
        hasOutdoorFurniture: Boolean(body.hasOutdoorFurniture),
        hasStairs: Boolean(body.hasStairs),
        hasHeavyItems: Boolean(body.hasHeavyItems),

        inventory: body.inventory || {},

        boxesAlreadyPacked: Number(body.boxesAlreadyPacked ?? 0),
        needsPackingMaterials: Boolean(body.needsPackingMaterials),
        smallBoxes: Number(body.smallBoxes ?? 0),
        mediumBoxes: Number(body.mediumBoxes ?? 0),

        commercialBusinessType: isCommercial ? (body.commercialBusinessType || null) : null,
        commercialSizeTier: isCommercial ? (body.commercialSizeTier || null) : null,

        serviceType,
        junkLoadSize: isJunkRemoval ? junkFields.loadSize : null,
        junkStairsFlights: isJunkRemoval ? junkFields.stairsFlights : 0,
        junkHeavyItemsCount: isJunkRemoval ? junkFields.heavyItemsCount : 0,
        junkConstructionDebris: isJunkRemoval ? junkFields.constructionDebris : false,
        junkSameDay: isJunkRemoval ? junkFields.sameDay : false,
        junkHazardousItems: isJunkRemoval ? junkFields.hazardousItems : false,

        ...pricingFields,

        estimatedPriceLow: totalEstimate,
        estimatedPriceHigh: totalEstimate,

        status: "quote_requested",
      } as typeof quoteRequestsTable.$inferInsert)
      .returning();

    recordTimelineEvent({
      jobId: quote.id,
      eventType: "quote_created",
      statusLabel: "Quote Requested",
      visibleToCustomer: true,
      notes: `${isJunkRemoval ? "Junk Removal" : "Moving"} Quote #${quote.id} created for ${quote.contactName}`,
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
      allow_promotion_codes: true,
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
