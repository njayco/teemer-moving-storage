const BRAND_COLOR = "#22C55E";
const SECONDARY_COLOR = "#0B132B";
const FONT_FAMILY = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function logoUrl(): string {
  const base = process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || "https://teemermoving.com";
  return `${base.replace(/\/$/, "")}/teemer-logo.jpg`;
}

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
            <td style="background:${SECONDARY_COLOR};padding:20px 32px;text-align:center;">
              <img src="${logoUrl()}" alt="Teemer Moving &amp; Storage" width="64" height="64" style="display:inline-block;border-radius:8px;background:#fff;padding:4px;vertical-align:middle;" />
              <div style="margin:8px 0 0;">
                <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:1px;">TEEMER M&amp;S</h1>
                <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;letter-spacing:2px;">MOVING &amp; STORAGE CORP.</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">${bodyHtml}</td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">Teemer Moving &amp; Storage Corp. &middot; Long Beach, NY 11561</p>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">(516) 269-3724 &middot; info@teemermoving.com</p>
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
    <td style="padding:6px 0;color:#64748b;font-size:13px;width:160px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:500;">${escapeHtml(value)}</td>
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
    ["Status", "Deposit Paid — Scheduling In Progress"],
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
      Hi ${escapeHtml(data.customerName)}, thank you for your deposit payment. Your move is being scheduled!
    </p>
    ${sectionHeading("Move Details")}
    ${detailTable(rows)}
    ${sectionHeading("Items & Boxes")}
    <p style="color:#475569;font-size:13px;line-height:1.6;margin:8px 0;">${escapeHtml(data.inventorySummary)}</p>
    <p style="color:#475569;font-size:13px;line-height:1.6;margin:4px 0;">${escapeHtml(data.boxesSummary)}</p>
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
      Hi ${escapeHtml(data.customerName)}, here's an update on your move (Quote #${data.quoteId}).
    </p>
    <div style="background:#f0fdf4;border-left:4px solid ${BRAND_COLOR};padding:12px 16px;border-radius:4px;margin:16px 0;">
      <p style="margin:0;color:${SECONDARY_COLOR};font-weight:600;font-size:14px;">${escapeHtml(data.statusLabel)}</p>
      <p style="margin:4px 0 0;color:#475569;font-size:13px;">${escapeHtml(data.message)}</p>
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
      Hi ${escapeHtml(data.customerName)}, use the button below to check the status of your move (Quote #${data.quoteId}) at any time.
    </p>
    ${ctaButton("Check Moving Job Status", data.trackingUrl)}
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">Bookmark this link for easy access.</p>
  `;
  return baseLayout("Your Tracking Link — Teemer Moving & Storage", body);
}

export interface RemainingBalanceSupplyItem {
  name: string;
  quantity: number;
  unitPrice: number;
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
  invoiceNumber?: string;
  dueDate?: string;
  payLink?: string;
  // Editable invoice extras (Task #43)
  numTrucks?: number;
  crewSize?: number;
  freeformText?: string;
  suppliesItems?: RemainingBalanceSupplyItem[];
}

function suppliesTable(items: RemainingBalanceSupplyItem[]): string {
  const rows = items
    .filter((it) => it && it.name && it.quantity > 0)
    .map((it) => {
      const lineTotal = (it.quantity || 0) * (it.unitPrice || 0);
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-size:13px;">${escapeHtml(it.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-size:13px;text-align:center;">${it.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-size:13px;text-align:right;">${formatCurrency(it.unitPrice)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-size:13px;text-align:right;font-weight:600;">${formatCurrency(lineTotal)}</td>
      </tr>`;
    })
    .join("");
  if (!rows) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;border:1px solid #e2e8f0;border-radius:6px;border-collapse:collapse;">
    <thead>
      <tr style="background:#f8fafc;">
        <th style="padding:8px 12px;text-align:left;color:${SECONDARY_COLOR};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Item</th>
        <th style="padding:8px 12px;text-align:center;color:${SECONDARY_COLOR};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Qty</th>
        <th style="padding:8px 12px;text-align:right;color:${SECONDARY_COLOR};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Unit</th>
        <th style="padding:8px 12px;text-align:right;color:${SECONDARY_COLOR};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function remainingBalanceInvoiceHtml(data: RemainingBalanceData): string {
  const payButton = data.payLink
    ? `<div style="text-align:center;margin:16px 0;">
         <a href="${escapeHtml(data.payLink)}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Pay Now</a>
       </div>`
    : "";

  const detailRows: [string, string][] = [["Move Date", data.moveDate]];
  if (data.dueDate) detailRows.push(["Due Date", data.dueDate]);
  if (data.crewSize) detailRows.push(["Crew Size", `${data.crewSize} mover${data.crewSize > 1 ? "s" : ""}`]);
  if (data.numTrucks) detailRows.push(["Trucks", `${data.numTrucks} truck${data.numTrucks > 1 ? "s" : ""}`]);
  detailRows.push(["Original Estimate", formatCurrency(data.totalEstimate)]);
  detailRows.push(["Extra Charges", formatCurrency(data.extraCharges)]);
  detailRows.push(["Discounts", `-${formatCurrency(data.discounts)}`]);
  detailRows.push(["Final Total", formatCurrency(data.finalTotal)]);
  detailRows.push(["Deposit Applied", `-${formatCurrency(data.depositPaid)}`]);

  const supplies = data.suppliesItems && data.suppliesItems.length > 0
    ? `${sectionHeading("Packing Supplies")}${suppliesTable(data.suppliesItems)}`
    : "";

  const freeform = data.freeformText && data.freeformText.trim().length > 0
    ? `${sectionHeading("Additional Notes")}<div style="background:#f8fafc;border-left:4px solid ${BRAND_COLOR};padding:12px 16px;border-radius:6px;color:#475569;font-size:13px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(data.freeformText)}</div>`
    : "";

  const body = `
    <h2 style="margin:0 0 8px;color:${SECONDARY_COLOR};font-size:20px;">Remaining Balance Invoice</h2>
    ${data.invoiceNumber ? `<p style="margin:0 0 4px;color:#64748b;font-size:13px;">Invoice #${escapeHtml(data.invoiceNumber)}</p>` : ""}
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      Hi ${escapeHtml(data.customerName)}, here is the invoice for the remaining balance on your move (Quote #${data.quoteId}).
    </p>
    ${sectionHeading("Invoice Details")}
    ${detailTable(detailRows)}
    ${supplies}
    ${freeform}
    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
      <p style="margin:0;color:#991b1b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Amount Due</p>
      <p style="margin:4px 0 0;color:#dc2626;font-size:28px;font-weight:700;">${formatCurrency(data.remainingBalance)}</p>
    </div>
    ${payButton}
    <p style="color:#64748b;font-size:12px;text-align:center;">${data.dueDate ? `Payment is due by ${escapeHtml(data.dueDate)}.` : "Payment is due on move day."} Contact us with any questions.</p>
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
      Hi ${escapeHtml(data.customerName)}, we've received your payment for Quote #${data.quoteId}. Thank you!
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

export interface ContractEmailData {
  customerName: string;
  moveDate: string;
  signingUrl: string;
  isAdminCopy?: boolean;
}

export function contractEmailHtml(data: ContractEmailData): string {
  const body = `
    <h2 style="margin:0 0 8px;color:${SECONDARY_COLOR};font-size:20px;">
      ${data.isAdminCopy ? "Contract Sent — Admin Copy" : "Your Moving Contract is Ready"}
    </h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      ${data.isAdminCopy
        ? `A moving contract has been sent to <strong>${escapeHtml(data.customerName)}</strong> for their move on ${escapeHtml(data.moveDate)}. The PDF is attached for your records.`
        : `Hi ${escapeHtml(data.customerName)}, your moving contract for the move scheduled on <strong>${escapeHtml(data.moveDate)}</strong> is attached as a PDF to this email.`
      }
    </p>
    ${!data.isAdminCopy ? `
    <div style="background:#f0fdf4;border-left:4px solid ${BRAND_COLOR};padding:14px 16px;border-radius:6px;margin:16px 0;">
      <p style="margin:0;color:#166534;font-size:13px;font-weight:600;">You can sign your contract electronically:</p>
      <p style="margin:4px 0 0;color:#475569;font-size:13px;">Click the button below to review the full contract and sign with your device. You may also sign a printed physical copy upon delivery.</p>
    </div>
    ${ctaButton("Sign Your Contract", data.signingUrl)}
    ` : ""}
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:16px 0 0;">Questions? Call us at (516) 269-3724</p>
  `;
  return baseLayout(data.isAdminCopy ? "Contract Sent — Teemer Admin" : "Your Moving Contract — Teemer Moving & Storage", body);
}

export interface BookingConfirmationData {
  customerName: string;
  email: string;
  quoteId: number;
  moveDate: string;
  arrivalWindow?: string;
  pickupAddress: string;
  dropoffAddress: string;
  crewSize?: number;
  estimatedHours?: number;
  trackingUrl: string;
}

export function bookingConfirmationHtml(data: BookingConfirmationData): string {
  const rows: [string, string][] = [
    ["Quote #", String(data.quoteId)],
    ["Status", "Booked — Confirmed"],
    ["Move Date", data.moveDate],
  ];
  if (data.arrivalWindow) rows.push(["Arrival Window", data.arrivalWindow]);
  rows.push(["Pickup", data.pickupAddress]);
  rows.push(["Dropoff", data.dropoffAddress]);
  if (data.crewSize) rows.push(["Crew Size", `${data.crewSize} movers`]);
  if (data.estimatedHours) rows.push(["Est. Hours", `${data.estimatedHours} hrs`]);

  const body = `
    <h2 style="margin:0 0 8px;color:${SECONDARY_COLOR};font-size:20px;">Your Move is Confirmed!</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      Hi ${escapeHtml(data.customerName)}, great news — your move has been officially booked and confirmed! Here are your move details:
    </p>
    ${sectionHeading("Move Details")}
    ${detailTable(rows)}
    <div style="background:#f0fdf4;border-left:4px solid ${BRAND_COLOR};padding:14px 16px;border-radius:6px;margin:16px 0;">
      <p style="margin:0;color:#166534;font-size:13px;font-weight:600;">What happens next?</p>
      <p style="margin:4px 0 0;color:#475569;font-size:13px;">Our team will reach out closer to your move date with final logistics and crew details. You can track your move status any time using the link below.</p>
    </div>
    ${ctaButton("Track Your Move", data.trackingUrl)}
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">Questions? Call us at (516) 269-3724</p>
  `;
  return baseLayout("Move Confirmed — Teemer Moving & Storage", body);
}

export interface DayBeforeReminderData {
  customerName: string;
  email: string;
  quoteId: number;
  jobId: number;
  moveDate: string;
  arrivalWindow?: string;
  pickupAddress: string;
  dropoffAddress: string;
  crewSize?: number;
  estimatedHours?: number;
  totalEstimate?: number;
  depositPaid?: number;
  remainingBalance?: number;
  trackingUrl: string;
}

export function dayBeforeReminderHtml(data: DayBeforeReminderData): string {
  const rows: [string, string][] = [
    ["Move Date", data.moveDate],
  ];
  if (data.arrivalWindow) rows.push(["Arrival Window", data.arrivalWindow]);
  rows.push(["Pickup", data.pickupAddress]);
  rows.push(["Dropoff", data.dropoffAddress]);
  if (data.crewSize) rows.push(["Crew Size", `${data.crewSize} movers`]);
  if (data.estimatedHours) rows.push(["Est. Hours", `${data.estimatedHours} hrs`]);

  const paymentRows: [string, string][] = [];
  if (data.totalEstimate != null) paymentRows.push(["Total Estimate", formatCurrency(data.totalEstimate)]);
  if (data.depositPaid != null) paymentRows.push(["Deposit Paid", formatCurrency(data.depositPaid)]);
  if (data.remainingBalance != null) paymentRows.push(["Remaining Balance", formatCurrency(data.remainingBalance)]);

  const body = `
    <h2 style="margin:0 0 8px;color:${SECONDARY_COLOR};font-size:20px;">Your Move is Tomorrow!</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      Hi ${escapeHtml(data.customerName)}, this is a friendly reminder that your move is scheduled for tomorrow. Please review the details below.
    </p>
    ${sectionHeading("Move Details")}
    ${detailTable(rows)}
    ${paymentRows.length > 0 ? `${sectionHeading("Payment Summary")}${detailTable(paymentRows)}` : ""}
    ${sectionHeading("Preparation Tips")}
    <ul style="color:#475569;font-size:13px;line-height:1.8;padding-left:20px;margin:8px 0;">
      <li>Ensure all items are packed and ready to go</li>
      <li>Clear pathways and hallways for the crew</li>
      <li>Set aside essentials (medications, valuables, documents) to keep with you</li>
      <li>Confirm parking and building access for the moving truck</li>
      <li>Have payment ready for any remaining balance</li>
    </ul>
    ${ctaButton("Track Your Move", data.trackingUrl)}
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">Questions? Call us at (516) 269-3724</p>
  `;
  return baseLayout("Move Reminder — Teemer Moving & Storage", body);
}

export interface SameDayCaptainAlertData {
  jobId: string;
  customerName: string;
  moveDate: string;
  arrivalWindow?: string;
  pickupAddress: string;
  destinationAddress: string;
  crewSize?: number;
  estimatedHours?: number;
  notes?: string;
  captainName?: string;
}

export function sameDayCaptainAlertHtml(data: SameDayCaptainAlertData): string {
  const rows: [string, string][] = [
    ["Job ID", data.jobId],
    ["Customer", data.customerName],
    ["Move Date", data.moveDate],
  ];
  if (data.captainName) rows.push(["Captain", data.captainName]);
  if (data.arrivalWindow) rows.push(["Arrival Window", data.arrivalWindow]);
  rows.push(["Pickup", data.pickupAddress]);
  rows.push(["Drop-off", data.destinationAddress]);
  if (data.crewSize) rows.push(["Crew Size", `${data.crewSize} movers`]);
  if (data.estimatedHours) rows.push(["Est. Hours", `${data.estimatedHours} hrs`]);
  if (data.notes) rows.push(["Notes", data.notes]);

  const body = `
    <div style="background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
      <p style="margin:0;color:#dc2626;font-size:18px;font-weight:700;letter-spacing:0.5px;">&#9888; SAME-DAY JOB ALERT</p>
      <p style="margin:6px 0 0;color:#7f1d1d;font-size:13px;">A new job has been booked for <strong>today</strong>. Immediate action required.</p>
    </div>
    <h2 style="margin:0 0 8px;color:${SECONDARY_COLOR};font-size:20px;">New Same-Day Move Booking</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      A job has just been created with today's move date. Please review the details below and coordinate with dispatch immediately.
    </p>
    ${sectionHeading("Job Details")}
    ${detailTable(rows)}
  `;
  return baseLayout("URGENT: Same-Day Job — Teemer Moving & Storage", body);
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
      Hi ${escapeHtml(data.customerName)}, your move (Quote #${data.quoteId}) on ${escapeHtml(data.moveDate)} has been completed.
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
