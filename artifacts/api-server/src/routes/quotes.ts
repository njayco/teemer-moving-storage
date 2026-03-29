import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { quoteRequestsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { calculatePricing } from "../lib/pricing-engine.js";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapQuoteRow(q: typeof quoteRequestsTable.$inferSelect) {
  return {
    id: String(q.id),
    status: q.status || "quote_requested",
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
    const { status } = req.body;
    if (!status) {
      res.status(400).json({ error: "status is required" });
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

    res.status(201).json(mapQuoteRow(quote));
  } catch (err) {
    req.log.error({ err }, "Failed to create quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
