import cron from "node-cron";
import { db } from "@workspace/db";
import { jobsTable, quoteRequestsTable, emailLogsTable } from "@workspace/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { sendDayBeforeReminderEmail } from "./email-service";
import { logger } from "./logger";

const TERMINAL_STATUSES = ["complete", "completed", "cancelled", "canceled"];

function getAppBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  const domain =
    process.env.REPLIT_DEPLOYMENT === "1"
      ? process.env.REPLIT_DOMAINS?.split(",")[0]
      : process.env.REPLIT_DEV_DOMAIN;
  return domain ? `https://${domain}` : "https://teemer.com";
}

export async function sendDayBeforeReminders(): Promise<number> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const statusList = TERMINAL_STATUSES.map((s) => `'${s}'`).join(", ");
  const jobs = await db
    .select()
    .from(jobsTable)
    .where(
      sql`${jobsTable.status} NOT IN (${sql.raw(statusList)}) AND ${jobsTable.dateTime} LIKE ${tomorrowStr + "%"}`
    );

  if (jobs.length === 0) {
    logger.info({ date: tomorrowStr }, "No jobs scheduled for tomorrow — no reminders to send");
    return 0;
  }

  let sentCount = 0;
  const baseUrl = getAppBaseUrl();

  for (const job of jobs) {
    try {
      const [alreadySent] = await db
        .select()
        .from(emailLogsTable)
        .where(
          and(
            eq(emailLogsTable.jobId, job.id),
            eq(emailLogsTable.emailType, "day_before_reminder"),
          )
        )
        .limit(1);

      if (alreadySent) {
        logger.info({ jobId: job.id }, "Day-before reminder already sent — skipping");
        continue;
      }

      let customerEmail = "";
      let customerName = job.customer;
      let arrivalWindow = job.arrivalWindow ?? undefined;
      let totalEstimate = job.finalTotal ?? job.estimatedPayout ?? 0;
      let depositPaid = job.depositPaid ?? 0;
      let remainingBalance = job.remainingBalance ?? (totalEstimate - depositPaid);
      let quoteId = job.quoteId;
      let trackingToken = job.trackingToken ?? "";

      if (job.quoteId) {
        const [quote] = await db
          .select()
          .from(quoteRequestsTable)
          .where(eq(quoteRequestsTable.id, job.quoteId))
          .limit(1);

        if (quote) {
          customerEmail = quote.email;
          customerName = quote.contactName || job.customer;
          arrivalWindow = arrivalWindow || quote.arrivalTimeWindow || undefined;
          trackingToken = trackingToken || quote.trackingToken || "";
        }
      }

      if (!customerEmail) {
        logger.warn({ jobId: job.id }, "No customer email found for job — skipping reminder");
        continue;
      }

      const trackingUrl = quoteId
        ? `${baseUrl}/track/${quoteId}/${trackingToken}`
        : `${baseUrl}`;

      await sendDayBeforeReminderEmail({
        customerName,
        email: customerEmail,
        quoteId: quoteId ?? 0,
        jobId: job.id,
        moveDate: job.dateTime,
        arrivalWindow,
        pickupAddress: job.originAddress || job.pickupLocation || "",
        dropoffAddress: job.destinationAddress || job.destination || "",
        crewSize: job.crewSize ?? undefined,
        estimatedHours: job.estimatedHours ?? undefined,
        totalEstimate,
        depositPaid,
        remainingBalance,
        trackingUrl,
      });

      sentCount++;
      logger.info({ jobId: job.id, email: customerEmail }, "Day-before reminder sent");
    } catch (err) {
      logger.error({ err, jobId: job.id }, "Failed to send day-before reminder");
    }
  }

  logger.info({ sentCount, totalJobs: jobs.length }, "Day-before reminder batch complete");
  return sentCount;
}

export function startReminderCron(): void {
  cron.schedule("0 9 * * *", async () => {
    logger.info("Running day-before reminder cron job");
    try {
      await sendDayBeforeReminders();
    } catch (err) {
      logger.error({ err }, "Day-before reminder cron job failed");
    }
  });

  logger.info("Day-before reminder cron job scheduled (daily at 9:00 AM)");
}
