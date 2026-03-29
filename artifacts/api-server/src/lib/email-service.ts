import { Resend } from "resend";
import { db } from "@workspace/db";
import { emailLogsTable } from "@workspace/db/schema";
import { logger } from "./logger";
import {
  depositConfirmationHtml,
  adminNewJobHtml,
  statusUpdateHtml,
  trackingLinkHtml,
  remainingBalanceInvoiceHtml,
  paymentReceivedHtml,
  jobCompletedHtml,
  type DepositConfirmationData,
  type AdminNewJobData,
  type StatusUpdateData,
  type TrackingLinkData,
  type RemainingBalanceData,
  type PaymentReceivedData,
  type JobCompletedData,
} from "./email-templates";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Teemer Moving <noreply@teemer.com>";
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "admin@teemer.com";

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
    });

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

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
