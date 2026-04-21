import { Resend } from "resend";
import { db } from "@workspace/db";
import { emailLogsTable, settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import {
  depositConfirmationHtml,
  adminNewJobHtml,
  statusUpdateHtml,
  trackingLinkHtml,
  remainingBalanceInvoiceHtml,
  paymentReceivedHtml,
  jobCompletedHtml,
  contractEmailHtml,
  bookingConfirmationHtml,
  dayBeforeReminderHtml,
  sameDayCaptainAlertHtml,
  type DepositConfirmationData,
  type AdminNewJobData,
  type StatusUpdateData,
  type TrackingLinkData,
  type RemainingBalanceData,
  type PaymentReceivedData,
  type JobCompletedData,
  type BookingConfirmationData,
  type DayBeforeReminderData,
  type SameDayCaptainAlertData,
} from "./email-templates";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Teemer Moving <noreply@teemer.com>";
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "alan@teemermoving.com";

async function getAlertEmails(): Promise<string[]> {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "alert_emails"));
    if (row) {
      const parsed = JSON.parse(row.value) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fall through to default
  }
  return [ADMIN_EMAIL];
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  emailType: string;
  quoteId?: number | null;
  jobId?: number | null;
  attachments?: Array<{ filename: string; content: Buffer }>;
}): Promise<{ success: boolean; resendId?: string }> {
  const resend = getResendClient();

  if (!resend) {
    logger.warn(
      { emailType: params.emailType, to: params.to },
      "RESEND_API_KEY not set — skipping email send"
    );
    await db.insert(emailLogsTable).values({
      quoteId: params.quoteId ?? null,
      jobId: params.jobId ?? null,
      emailType: params.emailType,
      recipient: params.to,
      resendId: null,
      status: "skipped",
    });
    return { success: false };
  }

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.attachments && params.attachments.length > 0
        ? { attachments: params.attachments.map((a) => ({ filename: a.filename, content: a.content })) }
        : {}),
    } as Parameters<typeof resend.emails.send>[0]);

    if (result.error) {
      logger.error(
        { error: result.error, emailType: params.emailType, to: params.to },
        "Resend API returned error"
      );
      await db.insert(emailLogsTable).values({
        quoteId: params.quoteId ?? null,
        jobId: params.jobId ?? null,
        emailType: params.emailType,
        recipient: params.to,
        resendId: null,
        status: "failed",
      });
      return { success: false };
    }

    const resendId = result.data?.id ?? null;

    await db.insert(emailLogsTable).values({
      quoteId: params.quoteId ?? null,
      jobId: params.jobId ?? null,
      emailType: params.emailType,
      recipient: params.to,
      resendId,
      status: "sent",
    });

    logger.info(
      { emailType: params.emailType, to: params.to, resendId },
      "Email sent successfully"
    );
    return { success: true, resendId: resendId ?? undefined };
  } catch (err) {
    logger.error(
      { err, emailType: params.emailType, to: params.to },
      "Failed to send email via Resend"
    );
    await db.insert(emailLogsTable).values({
      quoteId: params.quoteId ?? null,
      jobId: params.jobId ?? null,
      emailType: params.emailType,
      recipient: params.to,
      resendId: null,
      status: "failed",
    });
    return { success: false };
  }
}

export async function sendDepositConfirmationEmail(
  data: DepositConfirmationData
): Promise<{ success: boolean; resendId?: string }> {
  return sendEmail({
    to: data.email,
    subject: `Deposit Confirmed — Move on ${data.moveDate} (Quote #${data.quoteId})`,
    html: depositConfirmationHtml(data),
    emailType: "deposit_confirmation",
    quoteId: data.quoteId,
  });
}

export async function sendAdminNewJobNotification(
  data: AdminNewJobData
): Promise<{ success: boolean; resendId?: string }> {
  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `New Deposit: ${data.customerName} — ${data.moveDate} (Quote #${data.quoteId})`,
    html: adminNewJobHtml(data),
    emailType: "admin_new_job",
    quoteId: data.quoteId,
  });
}

export async function sendStatusUpdateEmail(
  data: StatusUpdateData & { email: string }
): Promise<{ success: boolean; resendId?: string }> {
  return sendEmail({
    to: data.email,
    subject: `Move Update: ${data.statusLabel} (Quote #${data.quoteId})`,
    html: statusUpdateHtml(data),
    emailType: "status_update",
    quoteId: data.quoteId,
  });
}

export async function sendTrackingLinkEmail(
  data: TrackingLinkData & { email: string }
): Promise<{ success: boolean; resendId?: string }> {
  return sendEmail({
    to: data.email,
    subject: `Your Move Tracking Link (Quote #${data.quoteId})`,
    html: trackingLinkHtml(data),
    emailType: "tracking_link",
    quoteId: data.quoteId,
  });
}

export async function sendRemainingBalanceInvoiceEmail(
  data: RemainingBalanceData & { email: string }
): Promise<{ success: boolean; resendId?: string }> {
  return sendEmail({
    to: data.email,
    subject: `Invoice: Remaining Balance Due — ${formatCurrency(data.remainingBalance)} (Quote #${data.quoteId})`,
    html: remainingBalanceInvoiceHtml(data),
    emailType: "remaining_balance_invoice",
    quoteId: data.quoteId,
  });
}

export async function sendPaymentReceivedEmail(
  data: PaymentReceivedData & { email: string }
): Promise<{ success: boolean; resendId?: string }> {
  return sendEmail({
    to: data.email,
    subject: `Payment Received — ${formatCurrency(data.paymentAmount)} (Quote #${data.quoteId})`,
    html: paymentReceivedHtml(data),
    emailType: "payment_received",
    quoteId: data.quoteId,
  });
}

export async function sendContractEmail(params: {
  to: string;
  customerName: string;
  moveDate: string;
  signingUrl: string;
  pdfBuffer: Buffer;
  jobId?: number | null;
  quoteId?: number | null;
  isAdminCopy?: boolean;
}): Promise<{ success: boolean; resendId?: string }> {
  const subject = params.isAdminCopy
    ? `Contract Sent — ${params.customerName} (Move: ${params.moveDate})`
    : `Your Moving Contract — Teemer Moving & Storage`;

  return sendEmail({
    to: params.to,
    subject,
    html: contractEmailHtml({
      customerName: params.customerName,
      moveDate: params.moveDate,
      signingUrl: params.signingUrl,
      isAdminCopy: params.isAdminCopy,
    }),
    emailType: "contract",
    jobId: params.jobId ?? null,
    quoteId: params.quoteId ?? null,
    attachments: [
      {
        filename: `Teemer-Moving-Contract.pdf`,
        content: params.pdfBuffer,
      },
    ],
  });
}

export async function sendJobCompletedEmail(
  data: JobCompletedData & { email: string }
): Promise<{ success: boolean; resendId?: string }> {
  return sendEmail({
    to: data.email,
    subject: `Move Completed! (Quote #${data.quoteId})`,
    html: jobCompletedHtml(data),
    emailType: "job_completed",
    quoteId: data.quoteId,
  });
}

export async function sendBookingConfirmationEmail(
  data: BookingConfirmationData
): Promise<{ success: boolean; resendId?: string }> {
  return sendEmail({
    to: data.email,
    subject: `Move Confirmed — ${data.moveDate} (Quote #${data.quoteId})`,
    html: bookingConfirmationHtml(data),
    emailType: "booking_confirmation",
    quoteId: data.quoteId,
  });
}

export async function sendDayBeforeReminderEmail(
  data: DayBeforeReminderData
): Promise<{ success: boolean; resendId?: string }> {
  return sendEmail({
    to: data.email,
    subject: `Reminder: Your Move is Tomorrow — ${data.moveDate} (Quote #${data.quoteId})`,
    html: dayBeforeReminderHtml(data),
    emailType: "day_before_reminder",
    quoteId: data.quoteId,
    jobId: data.jobId,
  });
}

export async function sendSameDayCaptainAlert(
  data: SameDayCaptainAlertData & { jobId_db?: number }
): Promise<{ success: boolean; resendId?: string }> {
  const recipients = await getAlertEmails();
  const subject = `URGENT: Same-Day Job Booked — ${data.customerName} (${data.moveDate})`;
  const html = sameDayCaptainAlertHtml(data);
  const emailType = "same_day_captain_alert";
  const jobId = data.jobId_db ?? null;

  const results = await Promise.all(
    recipients.map((to) => sendEmail({ to, subject, html, emailType, jobId }))
  );

  const anySuccess = results.some((r) => r.success);
  const firstResendId = results.find((r) => r.resendId)?.resendId;
  return { success: anySuccess, resendId: firstResendId };
}

export async function sendContactNotificationEmail(data: {
  name: string;
  email: string;
  phone: string;
  message: string;
}): Promise<{ success: boolean; resendId?: string }> {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const name = esc(data.name);
  const email = esc(data.email);
  const phone = esc(data.phone);
  const message = esc(data.message).replace(/\n/g, "<br />");

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8" /></head>
    <body style="font-family: Arial, sans-serif; background: #f8fafc; margin: 0; padding: 24px;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: #0f172a; padding: 24px 32px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px;">New Contact Form Message</h1>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 14px;">Teemer Moving &amp; Storage Corp. — Website</p>
        </div>
        <div style="padding: 32px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px; width: 100px; vertical-align: top;">Name</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px; vertical-align: top;">Email</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px;"><a href="mailto:${email}" style="color: #FF3C00; text-decoration: none;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px; vertical-align: top;">Phone</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px;"><a href="tel:${phone}" style="color: #FF3C00; text-decoration: none;">${phone}</a></td>
            </tr>
            <tr>
              <td style="padding: 12px 0 0; color: #64748b; font-size: 13px; vertical-align: top;">Message</td>
              <td style="padding: 12px 0 0; color: #0f172a; font-size: 14px; line-height: 1.6;">${message}</td>
            </tr>
          </table>
          <div style="margin-top: 24px; padding: 16px; background: #fff7ed; border-radius: 8px; border-left: 4px solid #FF3C00;">
            <p style="margin: 0; font-size: 13px; color: #7c2d12;">Reply directly to <strong>${email}</strong> or call <strong>${phone}</strong> to follow up.</p>
          </div>
        </div>
        <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">Teemer Moving &amp; Storage Corp. · Long Beach, NY 11561 · (516) 269-3724</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const subjectName = data.name.replace(/[\r\n\t]+/g, " ").trim();
  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `New Contact Form Submission — ${subjectName}`,
    html,
    emailType: "contact_form",
  });
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
