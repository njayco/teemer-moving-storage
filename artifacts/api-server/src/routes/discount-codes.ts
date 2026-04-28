import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { discountCodesTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const VALID_TYPES = ["percent", "fixed"] as const;
type DiscountType = typeof VALID_TYPES[number];

function serializeDiscountCode(row: typeof discountCodesTable.$inferSelect) {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    label: row.label,
    active: row.active,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    usageLimit: row.usageLimit ?? null,
    usageCount: row.usageCount,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

function parseExpiresAt(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function validateValue(type: DiscountType, value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) {
    return "value must be a positive number";
  }
  if (type === "percent" && value > 100) {
    return "percent value cannot exceed 100";
  }
  return null;
}

router.get("/admin/discount-codes", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(discountCodesTable)
      .orderBy(desc(discountCodesTable.createdAt));
    res.json(rows.map(serializeDiscountCode));
  } catch (err) {
    req.log.error({ err }, "Failed to list discount codes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/discount-codes", requireAdmin, async (req, res) => {
  try {
    const body = req.body ?? {};
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const type = body.type as DiscountType;
    const value = Number(body.value);
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const active = body.active === undefined ? true : Boolean(body.active);

    if (!code || !/^[A-Z0-9_-]{2,32}$/.test(code)) {
      res.status(400).json({ error: "code must be 2-32 chars (letters, digits, underscore, dash)" });
      return;
    }
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` });
      return;
    }
    const valueErr = validateValue(type, value);
    if (valueErr) {
      res.status(400).json({ error: valueErr });
      return;
    }
    if (!label) {
      res.status(400).json({ error: "label is required" });
      return;
    }

    let expiresAtParsed: Date | null = null;
    if (Object.prototype.hasOwnProperty.call(body, "expiresAt")) {
      const parsed = parseExpiresAt(body.expiresAt);
      if (parsed === undefined && body.expiresAt !== null && body.expiresAt !== "") {
        res.status(400).json({ error: "expiresAt must be a valid ISO datetime, null, or empty" });
        return;
      }
      expiresAtParsed = parsed === undefined ? null : parsed;
    }
    const usageLimitRaw = body.usageLimit;
    let usageLimit: number | null = null;
    if (usageLimitRaw !== undefined && usageLimitRaw !== null && usageLimitRaw !== "") {
      const n = Number(usageLimitRaw);
      if (!Number.isInteger(n) || n <= 0) {
        res.status(400).json({ error: "usageLimit must be a positive integer or null" });
        return;
      }
      usageLimit = n;
    }

    // Atomic insert: ON CONFLICT DO NOTHING returns no rows when a row with
    // the same `code` already exists (handles concurrent creates as well as
    // sequential duplicate submissions). We then surface a deterministic 409.
    const inserted = await db
      .insert(discountCodesTable)
      .values({
        code,
        type,
        value,
        label,
        active,
        expiresAt: expiresAtParsed,
        usageLimit,
      })
      .onConflictDoNothing({ target: discountCodesTable.code })
      .returning();

    if (inserted.length === 0) {
      res.status(409).json({ error: `Discount code "${code}" already exists` });
      return;
    }

    res.status(201).json(serializeDiscountCode(inserted[0]));
  } catch (err) {
    req.log.error({ err }, "Failed to create discount code");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/discount-codes/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid discount code ID" });
      return;
    }

    const [existing] = await db
      .select()
      .from(discountCodesTable)
      .where(eq(discountCodesTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Discount code not found" });
      return;
    }

    const body = req.body ?? {};
    const updates: Partial<typeof discountCodesTable.$inferInsert> = {};

    if (body.label !== undefined) {
      const label = typeof body.label === "string" ? body.label.trim() : "";
      if (!label) {
        res.status(400).json({ error: "label cannot be empty" });
        return;
      }
      updates.label = label;
    }
    if (body.type !== undefined) {
      if (!VALID_TYPES.includes(body.type)) {
        res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` });
        return;
      }
      updates.type = body.type;
    }
    if (body.value !== undefined) {
      const value = Number(body.value);
      const effectiveType = (updates.type ?? existing.type) as DiscountType;
      const valueErr = validateValue(effectiveType, value);
      if (valueErr) {
        res.status(400).json({ error: valueErr });
        return;
      }
      updates.value = value;
    }
    if (body.active !== undefined) {
      updates.active = Boolean(body.active);
    }
    if (Object.prototype.hasOwnProperty.call(body, "expiresAt")) {
      const parsed = parseExpiresAt(body.expiresAt);
      if (parsed === undefined && body.expiresAt !== null && body.expiresAt !== "") {
        res.status(400).json({ error: "expiresAt must be a valid ISO datetime, null, or empty" });
        return;
      }
      updates.expiresAt = parsed === undefined ? null : parsed;
    }
    if (Object.prototype.hasOwnProperty.call(body, "usageLimit")) {
      if (body.usageLimit === null || body.usageLimit === "") {
        updates.usageLimit = null;
      } else {
        const n = Number(body.usageLimit);
        if (!Number.isInteger(n) || n <= 0) {
          res.status(400).json({ error: "usageLimit must be a positive integer or null" });
          return;
        }
        updates.usageLimit = n;
      }
    }

    if (Object.keys(updates).length === 0) {
      res.json(serializeDiscountCode(existing));
      return;
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(discountCodesTable)
      .set(updates)
      .where(eq(discountCodesTable.id, id))
      .returning();

    res.json(serializeDiscountCode(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update discount code");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/discount-codes/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid discount code ID" });
      return;
    }

    const result = await db
      .delete(discountCodesTable)
      .where(eq(discountCodesTable.id, id))
      .returning({ id: discountCodesTable.id });

    if (result.length === 0) {
      res.status(404).json({ error: "Discount code not found" });
      return;
    }

    res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "Failed to delete discount code");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
