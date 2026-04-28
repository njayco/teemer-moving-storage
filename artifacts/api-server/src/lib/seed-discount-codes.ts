import { db } from "@workspace/db";
import { discountCodesTable } from "@workspace/db/schema";
import { logger } from "./logger";

interface SeedDiscountCode {
  code: string;
  type: "percent" | "fixed";
  value: number;
  label: string;
}

const SEED_CODES: SeedDiscountCode[] = [
  {
    code: "SANDV10",
    type: "percent",
    value: 10,
    label: "SANDV10 — 10% off (Seniors & Veterans)",
  },
];

export async function seedDiscountCodes(): Promise<void> {
  for (const dc of SEED_CODES) {
    try {
      // Use INSERT ... ON CONFLICT DO NOTHING (against the `code` UNIQUE
      // index) so concurrent app starts in multi-instance deployments do
      // not race or surface unique-constraint errors. `inserted` is empty
      // when the code already exists.
      const inserted = await db
        .insert(discountCodesTable)
        .values({
          code: dc.code,
          type: dc.type,
          value: dc.value,
          label: dc.label,
          active: true,
        })
        .onConflictDoNothing({ target: discountCodesTable.code })
        .returning({ id: discountCodesTable.id });

      if (inserted.length === 0) {
        logger.info({ code: dc.code }, "Discount code already exists, skipping seed");
      } else {
        logger.info({ code: dc.code }, "Discount code seeded successfully");
      }
    } catch (err) {
      logger.error({ err, code: dc.code }, "Failed to seed discount code");
    }
  }
}
