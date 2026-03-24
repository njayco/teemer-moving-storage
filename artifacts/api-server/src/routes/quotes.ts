import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { quoteRequestsTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

function calculateQuote(data: {
  moveType: string;
  moveSize?: string;
  packingHelpNeeded?: string;
  storageNeeded?: boolean;
  specialItems?: string;
  numberOfRooms?: number;
}): { low: number; high: number } {
  let base = 500;
  if (data.moveType === "long-distance") base += 500;
  const rooms = data.numberOfRooms || 1;
  base += rooms * 150;
  if (data.packingHelpNeeded === "full") base += 300;
  if (data.packingHelpNeeded === "partial") base += 150;
  if (data.storageNeeded) base += 200;
  if (data.specialItems && data.specialItems.toLowerCase().includes("piano")) base += 300;
  return { low: Math.round(base * 0.9), high: Math.round(base * 1.1) };
}

router.get("/quotes", async (req, res) => {
  try {
    const quotes = await db.select().from(quoteRequestsTable).orderBy(desc(quoteRequestsTable.createdAt));
    const mapped = quotes.map((q) => ({
      id: String(q.id),
      estimatedPriceLow: q.estimatedPriceLow || 0,
      estimatedPriceHigh: q.estimatedPriceHigh || 0,
      status: q.status || "pending",
      createdAt: q.createdAt?.toISOString() || new Date().toISOString(),
      quoteRequest: {
        moveType: q.moveType,
        residentialOrCommercial: q.residentialOrCommercial || "residential",
        originAddress: q.originAddress,
        destinationAddress: q.destinationAddress,
        moveDate: q.moveDate,
        moveSize: q.moveSize || undefined,
        numberOfRooms: q.numberOfRooms || undefined,
        packingHelpNeeded: q.packingHelpNeeded || "none",
        specialItems: q.specialItems || undefined,
        storageNeeded: q.storageNeeded || false,
        contactName: q.contactName,
        phone: q.phone,
        email: q.email,
        additionalNotes: q.additionalNotes || undefined,
      },
    }));
    res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch quotes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quotes", async (req, res) => {
  try {
    const body = req.body;
    const { low, high } = calculateQuote(body);
    const [quote] = await db
      .insert(quoteRequestsTable)
      .values({
        moveType: body.moveType,
        residentialOrCommercial: body.residentialOrCommercial || "residential",
        originAddress: body.originAddress,
        destinationAddress: body.destinationAddress,
        moveDate: body.moveDate,
        moveSize: body.moveSize,
        numberOfRooms: body.numberOfRooms,
        packingHelpNeeded: body.packingHelpNeeded || "none",
        specialItems: body.specialItems,
        storageNeeded: body.storageNeeded || false,
        contactName: body.contactName,
        phone: body.phone,
        email: body.email,
        additionalNotes: body.additionalNotes,
        estimatedPriceLow: low,
        estimatedPriceHigh: high,
        status: "pending",
      })
      .returning();

    res.status(201).json({
      id: String(quote.id),
      estimatedPriceLow: quote.estimatedPriceLow || low,
      estimatedPriceHigh: quote.estimatedPriceHigh || high,
      status: quote.status || "pending",
      createdAt: quote.createdAt?.toISOString() || new Date().toISOString(),
      quoteRequest: {
        moveType: quote.moveType,
        residentialOrCommercial: quote.residentialOrCommercial || "residential",
        originAddress: quote.originAddress,
        destinationAddress: quote.destinationAddress,
        moveDate: quote.moveDate,
        moveSize: quote.moveSize || undefined,
        numberOfRooms: quote.numberOfRooms || undefined,
        packingHelpNeeded: quote.packingHelpNeeded || "none",
        specialItems: quote.specialItems || undefined,
        storageNeeded: quote.storageNeeded || false,
        contactName: quote.contactName,
        phone: quote.phone,
        email: quote.email,
        additionalNotes: quote.additionalNotes || undefined,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
