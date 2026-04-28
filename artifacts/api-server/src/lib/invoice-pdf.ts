import PDFDocument from "pdfkit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

export interface InvoicePdfData {
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  jobId?: string | number;
  moveDate?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  lineItems?: Array<{ name: string; quantity?: number; unitPrice?: number; total: number }>;
  subtotal: number;
  extraCharges?: number;
  discounts?: number;
  finalTotal: number;
  depositApplied: number;
  remainingBalanceDue: number;
  status?: string;
  paidAt?: string | null;
  confirmationNumber?: string | null;
  dueDate?: string | null;
  createdAt?: string | null;
}

const NAVY = "#0B132B";
const GREEN = "#22C55E";
const GRAY = "#64748b";
const LIGHT = "#f1f5f9";

function resolveLogoPath(): string | null {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(here, "../../assets/teemer-logo.jpg"),
      path.resolve(here, "../../../assets/teemer-logo.jpg"),
      path.resolve(process.cwd(), "assets/teemer-logo.jpg"),
      path.resolve(process.cwd(), "artifacts/api-server/assets/teemer-logo.jpg"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function fmt(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount ?? 0);
}

export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const margin = 50;
    const pageW = doc.page.width;
    const usable = pageW - margin * 2;

    // Header band
    const headerH = 80;
    doc.rect(0, 0, pageW, headerH).fill(NAVY);
    const logoPath = resolveLogoPath();
    if (logoPath) {
      try {
        doc.image(logoPath, margin, 12, { fit: [56, 56] });
      } catch {
        /* ignore */
      }
    }
    doc
      .fillColor("#fff")
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("TEEMER MOVING & STORAGE CORP.", margin + (logoPath ? 70 : 0), 22, {
        width: usable - (logoPath ? 70 : 0),
      });
    doc
      .fillColor(GREEN)
      .fontSize(9)
      .font("Helvetica")
      .text("Long Beach, NY 11561  •  (516) 269-3724  •  info@teemermoving.com", margin + (logoPath ? 70 : 0), 44, {
        width: usable - (logoPath ? 70 : 0),
      });

    let y = headerH + 24;

    doc.fillColor(NAVY).fontSize(20).font("Helvetica-Bold").text("INVOICE", margin, y);
    doc
      .fillColor(GRAY)
      .fontSize(10)
      .font("Helvetica")
      .text(`Invoice #: ${data.invoiceNumber}`, margin, y + 28);
    if (data.createdAt) {
      doc.text(`Issued: ${data.createdAt}`, margin, y + 42);
    }
    if (data.dueDate) {
      doc.text(`Due: ${data.dueDate}`, margin, y + 56);
    }

    // Status badge top right
    const status = (data.status ?? "draft").toUpperCase();
    const isPaid = status === "PAID";
    const badgeColor = isPaid ? GREEN : "#f59e0b";
    doc
      .roundedRect(pageW - margin - 110, y, 110, 28, 6)
      .fillAndStroke(badgeColor, badgeColor);
    doc
      .fillColor("#fff")
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(status, pageW - margin - 110, y + 8, { width: 110, align: "center" });

    if (data.confirmationNumber) {
      doc
        .fillColor(GRAY)
        .fontSize(9)
        .font("Helvetica")
        .text(`Conf: ${data.confirmationNumber}`, pageW - margin - 200, y + 36, {
          width: 200,
          align: "right",
        });
    }
    if (data.paidAt) {
      doc.text(`Paid: ${data.paidAt}`, pageW - margin - 200, y + 50, { width: 200, align: "right" });
    }

    y += 88;

    // Bill-to / Move details
    doc.fillColor(NAVY).fontSize(10).font("Helvetica-Bold").text("BILL TO", margin, y);
    doc.font("Helvetica").fillColor(GRAY).text(data.customerName, margin, y + 14);
    if (data.customerEmail) doc.text(data.customerEmail, margin, y + 28);
    if (data.customerPhone) doc.text(data.customerPhone, margin, y + 42);

    doc.fillColor(NAVY).fontSize(10).font("Helvetica-Bold").text("MOVE DETAILS", margin + usable / 2, y);
    doc.font("Helvetica").fillColor(GRAY);
    let yr = y + 14;
    if (data.jobId) {
      doc.text(`Job #${data.jobId}`, margin + usable / 2, yr);
      yr += 14;
    }
    if (data.moveDate) {
      doc.text(`Move Date: ${data.moveDate}`, margin + usable / 2, yr);
      yr += 14;
    }
    if (data.pickupAddress) {
      doc.text(`Pickup: ${data.pickupAddress}`, margin + usable / 2, yr, { width: usable / 2 });
      yr = doc.y;
    }
    if (data.dropoffAddress) {
      doc.text(`Dropoff: ${data.dropoffAddress}`, margin + usable / 2, yr, { width: usable / 2 });
    }

    y = Math.max(y + 60, yr + 16);

    // Line items table
    const tableTop = y + 8;
    doc.rect(margin, tableTop, usable, 22).fill(LIGHT);
    doc
      .fillColor(NAVY)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("DESCRIPTION", margin + 8, tableTop + 7)
      .text("QTY", margin + usable - 200, tableTop + 7, { width: 40, align: "right" })
      .text("UNIT", margin + usable - 150, tableTop + 7, { width: 60, align: "right" })
      .text("AMOUNT", margin + usable - 80, tableTop + 7, { width: 72, align: "right" });

    let rowY = tableTop + 24;
    const items =
      data.lineItems && data.lineItems.length > 0
        ? data.lineItems
        : [{ name: "Moving services", quantity: 1, unitPrice: data.subtotal, total: data.subtotal }];

    doc.font("Helvetica").fontSize(9).fillColor(NAVY);
    for (const item of items) {
      doc.text(item.name, margin + 8, rowY, { width: usable - 220 });
      doc.text(String(item.quantity ?? ""), margin + usable - 200, rowY, { width: 40, align: "right" });
      doc.text(item.unitPrice != null ? fmt(item.unitPrice) : "", margin + usable - 150, rowY, {
        width: 60,
        align: "right",
      });
      doc.text(fmt(item.total ?? 0), margin + usable - 80, rowY, { width: 72, align: "right" });
      rowY += 18;
    }

    // Totals box
    rowY += 12;
    doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(margin + usable / 2, rowY).lineTo(margin + usable, rowY).stroke();
    rowY += 8;
    const writeRow = (label: string, value: number, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fillColor(bold ? NAVY : GRAY).fontSize(10);
      doc.text(label, margin + usable / 2, rowY, { width: usable / 2 - 80 });
      doc.text(fmt(value), margin + usable - 80, rowY, { width: 72, align: "right" });
      rowY += 16;
    };
    writeRow("Subtotal", data.subtotal ?? 0);
    if ((data.extraCharges ?? 0) > 0) writeRow("Extra Charges", data.extraCharges ?? 0);
    if ((data.discounts ?? 0) > 0) writeRow("Discounts", -(data.discounts ?? 0));
    writeRow("Total", data.finalTotal ?? 0, true);
    if ((data.depositApplied ?? 0) > 0) writeRow("Deposit Applied", -(data.depositApplied ?? 0));
    rowY += 4;
    doc
      .fillColor(NAVY)
      .strokeColor(GREEN)
      .lineWidth(1)
      .roundedRect(margin + usable / 2, rowY, usable / 2, 32, 6)
      .stroke();
    doc
      .fillColor(NAVY)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(isPaid ? "Total Paid" : "Balance Due", margin + usable / 2 + 8, rowY + 10);
    doc
      .fillColor(isPaid ? GREEN : "#dc2626")
      .fontSize(14)
      .text(fmt(isPaid ? data.finalTotal ?? 0 : data.remainingBalanceDue ?? 0), margin + usable - 80, rowY + 8, {
        width: 72,
        align: "right",
      });

    // Footer
    doc
      .fillColor(GRAY)
      .font("Helvetica")
      .fontSize(8)
      .text(
        "Thank you for choosing Teemer Moving & Storage. Questions? Reply to your invoice email or call (516) 269-3724.",
        margin,
        doc.page.height - 60,
        { width: usable, align: "center" },
      );

    doc.end();
  });
}
