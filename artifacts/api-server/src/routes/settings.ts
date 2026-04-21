import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const ALERT_EMAILS_KEY = "alert_emails";
const DEFAULT_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "alan@teemermoving.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmailsFromRow(value: string): string[] | null {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((e) => typeof e === "string")) {
      return parsed;
    }
  } catch {
    // malformed JSON — fall through
  }
  return null;
}

router.get("/admin/settings/alert-emails", requireAdmin, async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, ALERT_EMAILS_KEY));

    if (!row) {
      res.json({ emails: [DEFAULT_EMAIL] });
      return;
    }

    const emails = parseEmailsFromRow(row.value);
    if (!emails) {
      req.log.warn({ value: row.value }, "alert_emails setting contained invalid JSON, returning default");
      res.json({ emails: [DEFAULT_EMAIL] });
      return;
    }

    res.json({ emails });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch alert emails setting");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/settings/alert-emails", requireAdmin, async (req, res) => {
  try {
    const { emails } = req.body as { emails: unknown };

    if (!Array.isArray(emails) || emails.length === 0) {
      res.status(400).json({ error: "emails must be a non-empty array" });
      return;
    }

    const invalid = emails.filter((e) => typeof e !== "string" || !EMAIL_RE.test(e));
    if (invalid.length > 0) {
      res.status(400).json({ error: "All entries must be valid email addresses" });
      return;
    }

    const value = JSON.stringify(emails as string[]);

    await db
      .insert(settingsTable)
      .values({ key: ALERT_EMAILS_KEY, value })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { value, updatedAt: new Date() },
      });

    res.json({ emails });
  } catch (err) {
    req.log.error({ err }, "Failed to update alert emails setting");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
