import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { emailLogsTable, jobsTable } from "@workspace/db/schema";
import { eq, or, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/admin/email-logs/quote/:quoteId", requireAdmin, async (req, res) => {
  try {
    const quoteId = parseInt(String(req.params.quoteId), 10);
    if (isNaN(quoteId)) {
      res.status(400).json({ error: "Invalid quote ID" });
      return;
    }

    const logs = await db
      .select()
      .from(emailLogsTable)
      .where(eq(emailLogsTable.quoteId, quoteId))
      .orderBy(desc(emailLogsTable.sentAt));

    res.json(formatLogs(logs));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch email logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/email-logs/:jobId", requireAdmin, async (req, res) => {
  try {
    const jobId = parseInt(String(req.params.jobId), 10);
    if (isNaN(jobId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [job] = await db
      .select({ quoteId: jobsTable.quoteId })
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    const conditions = [eq(emailLogsTable.jobId, jobId)];
    if (job?.quoteId) {
      conditions.push(eq(emailLogsTable.quoteId, job.quoteId));
    }

    const logs = await db
      .select()
      .from(emailLogsTable)
      .where(or(...conditions))
      .orderBy(desc(emailLogsTable.sentAt));

    res.json(formatLogs(logs));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch email logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

function formatLogs(logs: (typeof emailLogsTable.$inferSelect)[]) {
  return logs.map((log) => ({
    id: log.id,
    quoteId: log.quoteId,
    jobId: log.jobId,
    emailType: log.emailType,
    recipient: log.recipient,
    resendId: log.resendId,
    status: log.status,
    sentAt: log.sentAt?.toISOString() ?? null,
  }));
}

export default router;
