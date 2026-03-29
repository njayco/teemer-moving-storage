const BRAND_COLOR = "#22C55E";
const SECONDARY_COLOR = "#0B132B";
const FONT_FAMILY = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

function baseLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:${FONT_FAMILY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
          <tr>
            <td style="background:${SECONDARY_COLOR};padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:1px;">TEEMER M&amp;S</h1>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;letter-spacing:2px;">MOVING &amp; STORAGE CORP.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">${bodyHtml}</td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">Teemer Moving &amp; Storage Corp. &middot; Long Beach, NY 11561</p>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">(516) 269-3724 &middot; info@teemer.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr>
      <td style="background:${BRAND_COLOR};border-radius:8px;padding:12px 32px;">
        <a href="${url}" style="color:#fff;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">${text}</a>
      </td>
    </tr>
  </table>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#64748b;font-size:13px;width:160px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:500;">${value}</td>
  </tr>`;
}

function detailTable(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
    ${rows.map(([l, v]) => detailRow(l, v)).join("")}
  </table>`;
}

function sectionHeading(text: string): string {
  return `<h2 style="margin:24px 0 8px;color:${SECONDARY_COLOR};font-size:16px;font-weight:600;border-bottom:2px solid ${BRAND_COLOR};padding-bottom:6px;">${text}</h2>`;
}

function formatCurrency(amount: number | null | undefined): string {
  return `$${(amount ?? 0).toFixed(2)}`;
}

export interface DepositConfirmationData {
  customerName: string;
  email: string;
  quoteId: number;
  moveDate: string;
  arrivalWindow?: string;
  pickupAddress: string;
  dropoffAddress: string;
  secondStop?: string;
  inventorySummary: string;
  boxesSummary: string;
  crewSize?: number;
  estimatedHours?: number;
  totalEstimate: number;
  depositPaid: number;
  remainingBalance: number;
  trackingUrl: string;
}

export function depositConfirmationHtml(data: DepositConfirmationData): string {
  const rows: [string, string][] = [
    ["Quote #", String(data.quoteId)],
    ["Move Date", data.moveDate],
  ];
  if (data.arrivalWindow) rows.push(["Arrival Window", data.arrivalWindow]);
  rows.push(["Pickup", data.pickupAddress]);
  rows.push(["Dropoff", data.dropoffAddress]);
  if (data.secondStop) rows.push(["Second Stop", data.secondStop]);
  if (data.crewSize) rows.push(["Crew Size", `${data.crewSize} movers`]);
  if (data.estimatedHours) rows.push(["Est. Hours", `${data.estimatedHours} hrs`]);

  const body = `
    <h2 style="margin:0 0 8px;color:${SECONDARY_COLOR};font-size:20px;">Deposit Confirmed!</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      Hi ${data.customerName}, thank you for your deposit payment. Your move is being scheduled!
    </p>
    ${sectionHeading("Move Details")}
    ${detailTable(rows)}
    ${sectionHeading("Items & Boxes")}
    <p style="color:#475569;font-size:13px;line-height:1.6;margin:8px 0;">${data.inventorySummary}</p>
    <p style="color:#475569;font-size:13px;line-height:1.6;margin:4px 0;">${data.boxesSummary}</p>
    ${sectionHeading("Payment Summary")}
    ${detailTable([
      ["Total Estimate", formatCurrency(data.totalEstimate)],
      ["Deposit Paid", formatCurrency(data.depositPaid)],
      ["Remaining Balance", formatCurrency(data.remainingBalance)],
    ])}
    <p style="color:#64748b;font-size:12px;margin:16px 0 0;">The remaining balance is due on move day.</p>
    ${ctaButton("Check Moving Job Status", data.trackingUrl)}
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">Questions? Call us at (516) 269-3724</p>
  `;
  return baseLayout("Deposit Confirmed — Teemer Moving & Storage", body);
}

export interface AdminNewJobData {
  quoteId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  moveDate: string;
  pickupAddress: string;
  dropoffAddress: string;
  totalEstimate: number;
  depositPaid: number;
}

export function adminNewJobHtml(data: AdminNewJobData): string {
  const body = `
    <h2 style="margin:0 0 8px;color:${SECONDARY_COLOR};font-size:20px;">New Deposit Received</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;">A customer has paid their deposit. Review the details below.</p>
    ${sectionHeading("Customer")}
    ${detailTable([
      ["Name", data.customerName],
      ["Email", data.customerEmail],
      ["Phone", data.customerPhone],
    ])}
    ${sectionHeading("Move")}
    ${detailTable([
      ["Quote #", String(data.quoteId)],
      ["Date", data.moveDate],
      ["Pickup", data.pickupAddress],
      ["Dropoff", data.dropoffAddress],
    ])}
    ${sectionHeading("Payment")}
    ${detailTable([
      ["Total Estimate", formatCurrency(data.totalEstimate)],
      ["Deposit Paid", formatCurrency(data.depositPaid)],
      ["Remaining", formatCurrency(data.totalEstimate - data.depositPaid)],
    ])}
  `;
  return baseLayout("New Deposit — Teemer Admin", body);
}

export interface StatusUpdateData {
  customerName: string;
  quoteId: number;
  status: string;
  statusLabel: string;
  message: string;
  trackingUrl?: string;
}

export function statusUpdateHtml(data: StatusUpdateData): string {
  const body = `
    <h2 style="margin:0 0 8px;color:${SECONDARY_COLOR};font-size:20px;">Move Status Update</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      Hi ${data.customerName}, here's an update on your move (Quote #${data.quoteId}).
    </p>
    <div style="background:#f0fdf4;border-left:4px solid ${BRAND_COLOR};padding:12px 16px;border-radius:4px;margin:16px 0;">
      <p style="margin:0;color:${SECONDARY_COLOR};font-weight:600;font-size:14px;">${data.statusLabel}</p>
      <p style="margin:4px 0 0;color:#475569;font-size:13px;">${data.message}</p>
    </div>
    ${data.trackingUrl ? ctaButton("Track Your Move", data.trackingUrl) : ""}
  `;
  return baseLayout("Move Update — Teemer Moving & Storage", body);
}

export interface TrackingLinkData {
  customerName: string;
  quoteId: number;
  trackingUrl: string;
}

export function trackingLinkHtml(data: TrackingLinkData): string {
  const body = `
    <h2 style="margin:0 0 8px;color:${SECONDARY_COLOR};font-size:20px;">Your Tracking Link</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      Hi ${data.customerName}, use the button below to check the status of your move (Quote #${data.quoteId}) at any time.
    </p>
    ${ctaButton("Check Moving Job Status", data.trackingUrl)}
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">Bookmark this link for easy access.</p>
  `;
  return baseLayout("Your Tracking Link — Teemer Moving & Storage", body);
}

export interface RemainingBalanceData {
  customerName: string;
  quoteId: number;
  moveDate: string;
  totalEstimate: number;
  depositPaid: number;
  extraCharges: number;
  discounts: number;
  finalTotal: number;
  remainingBalance: number;
}

export function remainingBalanceInvoiceHtml(data: RemainingBalanceData): string {
  const body = `
    <h2 style="margin:0 0 8px;color:${SECONDARY_COLOR};font-size:20px;">Remaining Balance Invoice</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      Hi ${data.customerName}, here is the invoice for the remaining balance on your move (Quote #${data.quoteId}).
    </p>
    ${sectionHeading("Invoice Details")}
    ${detailTable([
      ["Move Date", data.moveDate],
      ["Original Estimate", formatCurrency(data.totalEstimate)],
      ["Extra Charges", formatCurrency(data.extraCharges)],
      ["Discounts", `-${formatCurrency(data.discounts)}`],
      ["Final Total", formatCurrency(data.finalTotal)],
      ["Deposit Applied", `-${formatCurrency(data.depositPaid)}`],
    ])}
    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
      <p style="margin:0;color:#991b1b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Amount Due</p>
      <p style="margin:4px 0 0;color:#dc2626;font-size:28px;font-weight:700;">${formatCurrency(data.remainingBalance)}</p>
    </div>
    <p style="color:#64748b;font-size:12px;text-align:center;">Payment is due on move day. Contact us with any questions.</p>
  `;
  return baseLayout("Invoice — Teemer Moving & Storage", body);
}

export interface PaymentReceivedData {
  customerName: string;
  quoteId: number;
  paymentAmount: number;
  paymentMethod: string;
  remainingBalance: number;
}

export function paymentReceivedHtml(data: PaymentReceivedData): string {
  const body = `
    <h2 style="margin:0 0 8px;color:${SECONDARY_COLOR};font-size:20px;">Payment Received</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      Hi ${data.customerName}, we've received your payment for Quote #${data.quoteId}. Thank you!
    </p>
    ${detailTable([
      ["Amount Paid", formatCurrency(data.paymentAmount)],
      ["Method", data.paymentMethod],
      ["Remaining Balance", formatCurrency(data.remainingBalance)],
    ])}
    ${data.remainingBalance <= 0
      ? `<div style="background:#f0fdf4;border-radius:8px;padding:12px;text-align:center;margin:16px 0;">
           <p style="margin:0;color:#16a34a;font-weight:600;">Paid in Full</p>
         </div>`
      : ""}
  `;
  return baseLayout("Payment Received — Teemer Moving & Storage", body);
}

export interface JobCompletedData {
  customerName: string;
  quoteId: number;
  moveDate: string;
  finalTotal: number;
}

export function jobCompletedHtml(data: JobCompletedData): string {
  const body = `
    <h2 style="margin:0 0 8px;color:${SECONDARY_COLOR};font-size:20px;">Move Completed!</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      Hi ${data.customerName}, your move (Quote #${data.quoteId}) on ${data.moveDate} has been completed.
      Thank you for choosing Teemer Moving & Storage!
    </p>
    ${detailTable([
      ["Move Date", data.moveDate],
      ["Final Total", formatCurrency(data.finalTotal)],
    ])}
    <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;margin:16px 0;">
      <p style="margin:0;color:#16a34a;font-size:16px;font-weight:600;">Thank you for choosing Teemer!</p>
      <p style="margin:4px 0 0;color:#475569;font-size:13px;">We'd love your feedback. Feel free to leave us a review.</p>
    </div>
  `;
  return baseLayout("Move Completed — Teemer Moving & Storage", body);
}
