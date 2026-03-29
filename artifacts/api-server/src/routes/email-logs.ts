import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { emailLogsTable } from "@workspace/db/schema";
import { eq, or, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/admin/email-logs/:quoteId", requireAdmin, async (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId, 10);
    if (isNaN(quoteId)) {
      res.status(400).json({ error: "Invalid quote ID" });
      return;
    }

    const logs = await db
      .select()
      .from(emailLogsTable)
      .where(or(eq(emailLogsTable.quoteId, quoteId), eq(emailLogsTable.jobId, quoteId)))
      .orderBy(desc(emailLogsTable.sentAt));

    res.json(
      logs.map((log) => ({
        id: log.id,
        quoteId: log.quoteId,
        jobId: log.jobId,
        emailType: log.emailType,
        recipient: log.recipient,
        resendId: log.resendId,
        status: log.status,
        sentAt: log.sentAt?.toISOString() ?? null,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fetch email logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
