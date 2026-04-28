import PDFDocument from "pdfkit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { getEffectiveMountedTVFee } from "./pricing-engine.js";

export interface ContractData {
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  pickupAddress2?: string;
  dropoffAddress: string;
  crewSize?: number;
  estimatedHours?: number;
  moveDate?: string;
  arrivalWindow?: string;
  inventory?: Record<string, number>;
  additionalNotes?: string;
  jobId?: string;
  quoteId?: number;
  totalEstimate?: number;
  depositAmount?: number;
  // Task #43 additions
  parkingInstructions?: string;
  packingDate?: string;
  packingArrivalWindow?: string;
  hasMountedTVs?: boolean;
  mountedTVCount?: number;
  // Task #45: per-TV dismount/remount fee, included in totalEstimate.
  mountedTVFee?: number;
}

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
    /* fall through */
  }
  return null;
}

function parseArrivalWindow(window: string): { start: string; end: string } | null {
  if (!window) return null;
  const m = window.match(/([0-9]{1,2}(?::[0-9]{2})?\s?[AP]M)\s*[–-]\s*([0-9]{1,2}(?::[0-9]{2})?\s?[AP]M)/i);
  if (!m) return null;
  return { start: m[1].trim(), end: m[2].trim() };
}

function estimateEndTime(window: string, hours: number | undefined): string | null {
  const parsed = parseArrivalWindow(window);
  if (!parsed || !hours || hours <= 0) return null;
  const m = parsed.start.match(/([0-9]{1,2})(?::([0-9]{2}))?\s?([AP]M)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  const totalMin = h * 60 + minutes + Math.round(hours * 60);
  const endH24 = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  const endAmpm = endH24 >= 12 ? "PM" : "AM";
  const endH12 = ((endH24 + 11) % 12) + 1;
  return `${endH12}:${String(endM).padStart(2, "0")} ${endAmpm}`;
}

const GREEN = "#22C55E";
const NAVY = "#0B132B";
const GRAY = "#64748b";
const LIGHT_GRAY = "#f1f5f9";

function drawHRule(doc: InstanceType<typeof PDFDocument>, y: number, margin: number = 50) {
  const width = doc.page.width - margin * 2;
  doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(margin, y).lineTo(margin + width, y).stroke();
}

function sectionHeader(doc: InstanceType<typeof PDFDocument>, title: string, y: number, margin: number = 50): number {
  doc
    .fillColor(NAVY)
    .fontSize(11)
    .font("Helvetica-Bold")
    .text(title, margin, y);
  const lineY = y + 16;
  doc.strokeColor(GREEN).lineWidth(2).moveTo(margin, lineY).lineTo(margin + 200, lineY).stroke();
  return lineY + 8;
}

function labelValue(doc: InstanceType<typeof PDFDocument>, label: string, value: string, x: number, y: number, labelWidth: number = 120): number {
  doc.fillColor(GRAY).fontSize(9).font("Helvetica").text(label, x, y, { width: labelWidth });
  doc.fillColor("#1e293b").fontSize(9).font("Helvetica").text(value || "—", x + labelWidth, y, { width: 240 });
  return y + 14;
}

function legalSection(doc: InstanceType<typeof PDFDocument>, title: string, body: string, y: number, margin: number = 50): number {
  doc.fillColor(NAVY).fontSize(9).font("Helvetica-Bold").text(title, margin, y);
  y += 12;
  doc
    .fillColor(GRAY)
    .fontSize(8.5)
    .font("Helvetica")
    .text(body, margin, y, { width: doc.page.width - margin * 2, lineGap: 1.5 });
  y = doc.y + 10;
  return y;
}

export function generateContractPdf(data: ContractData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 50, bottom: 50, left: 50, right: 50 } });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const margin = 50;
    const usableWidth = pageW - margin * 2;

    const headerH = 86;
    doc
      .rect(0, 0, pageW, headerH)
      .fill(NAVY);

    const logoPath = resolveLogoPath();
    if (logoPath) {
      try {
        doc.image(logoPath, margin, 12, { fit: [62, 62], valign: "center" });
      } catch {
        /* ignore image errors and fall back to text */
      }
    }

    doc
      .fillColor("#ffffff")
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("TEEMER MOVING & STORAGE CORP.", margin + (logoPath ? 72 : 0), 22, { width: usableWidth - (logoPath ? 72 : 0), align: logoPath ? "left" : "center" });
    doc
      .fillColor(GREEN)
      .fontSize(9)
      .font("Helvetica")
      .text("Long Beach, NY 11561  •  (516) 269-3724  •  info@teemermoving.com", margin + (logoPath ? 72 : 0), 44, { width: usableWidth - (logoPath ? 72 : 0), align: logoPath ? "left" : "center" });
    doc
      .fillColor("#94a3b8")
      .fontSize(7.5)
      .font("Helvetica")
      .text("US DOT # 3716575  •  MC # 1306475", margin + (logoPath ? 72 : 0), 60, { width: usableWidth - (logoPath ? 72 : 0), align: logoPath ? "left" : "center" });

    let y = headerH + 20;

    doc
      .fillColor(NAVY)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("MOVING CONTRACT", margin, y, { width: usableWidth, align: "center" });
    y += 24;
    drawHRule(doc, y, margin);
    y += 12;

    y = sectionHeader(doc, "CONTRACT OVERVIEW", y, margin);
    y += 4;
    y = labelValue(doc, "MOVER:", "Teemer Moving and Storage Corp", margin, y);
    y = labelValue(doc, "CUSTOMER/CLIENT:", data.customerName, margin, y);
    y = labelValue(doc, "PHONE NUMBER:", data.customerPhone, margin, y);
    const contractDateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    y = labelValue(doc, "CONTRACT DATE:", contractDateStr, margin, y);
    const scheduledStr = data.moveDate
      ? (data.arrivalWindow ? `${data.moveDate} from approximately ${data.arrivalWindow}` : data.moveDate)
      : "—";
    y = labelValue(doc, "SCHEDULED DATE & TIME:", scheduledStr, margin, y);
    y += 6;
    drawHRule(doc, y, margin);
    y += 12;

    y = sectionHeader(doc, "DESTINATION ROUTE", y, margin);
    y += 4;
    y = labelValue(doc, "Pick up address:", data.pickupAddress, margin, y);
    if (data.pickupAddress2) {
      y = labelValue(doc, "Pick up address 2:", data.pickupAddress2, margin, y);
    }
    y = labelValue(doc, "Drop off address:", data.dropoffAddress, margin, y);
    y += 6;
    drawHRule(doc, y, margin);
    y += 12;

    y = sectionHeader(doc, "SERVICES TO BE PERFORMED ON THIS SHIPMENT", y, margin);
    y += 4;
    if (data.crewSize) {
      const trucks = Math.ceil(data.crewSize / 3);
      y = labelValue(doc, "Men and Equipment:", `${data.crewSize} men and ${trucks} truck${trucks > 1 ? "s" : ""}`, margin, y);
    }
    if (data.estimatedHours) {
      y = labelValue(doc, "Labor time (hour):", `${data.estimatedHours} hours (minimum)`, margin, y);
    }
    if (data.moveDate) {
      const dateStr = data.arrivalWindow ? `${data.moveDate} from approximately ${data.arrivalWindow}` : data.moveDate;
      y = labelValue(doc, "Scheduled date and time:", dateStr, margin, y);
    }
    if (data.arrivalWindow) {
      const parsed = parseArrivalWindow(data.arrivalWindow);
      if (parsed) {
        y = labelValue(doc, "Moving day START:", parsed.start, margin, y);
        const estEnd = estimateEndTime(data.arrivalWindow, data.estimatedHours);
        if (estEnd) {
          y = labelValue(doc, "Estimated END:", `${estEnd} (based on ${data.estimatedHours} hr estimate)`, margin, y);
        }
      }
    }
    y += 6;
    drawHRule(doc, y, margin);
    y += 12;

    if (data.packingDate) {
      y = sectionHeader(doc, "PACKING DAY (DAY BEFORE MOVE)", y, margin);
      y += 4;
      y = labelValue(doc, "Packing date:", data.packingDate, margin, y);
      if (data.packingArrivalWindow) {
        y = labelValue(doc, "Packing arrival window:", data.packingArrivalWindow, margin, y);
      }
      doc
        .fillColor(GRAY)
        .fontSize(8.5)
        .font("Helvetica-Oblique")
        .text("Required for moves estimated at 5 hours or more. Crew will pack all loose belongings the day before.", margin, y, { width: usableWidth, lineGap: 1.5 });
      y = doc.y + 8;
      drawHRule(doc, y, margin);
      y += 12;
    }

    // Only render the mounted-TV section if the customer was actually
    // charged for it (fee snapshot > 0). Legacy quotes had hasMountedTVs
    // recorded but no fee in their total, so we omit the dollar amount
    // entirely rather than imply a charge they never agreed to.
    const tvFee = getEffectiveMountedTVFee({
      hasMountedTVs: data.hasMountedTVs,
      storedFee: data.mountedTVFee,
    });
    if (data.hasMountedTVs && tvFee > 0) {
      const tvCount = data.mountedTVCount && data.mountedTVCount > 0 ? data.mountedTVCount : 1;
      y = sectionHeader(doc, "MOUNTED TVs", y, margin);
      y += 4;
      y = labelValue(
        doc,
        "TVs to unmount/remount:",
        `${tvCount} mounted TV${tvCount > 1 ? "s" : ""} — $${tvFee.toFixed(2)} ($${(tvFee / tvCount).toFixed(2)}/TV)`,
        margin,
        y,
      );
      doc
        .fillColor(GRAY)
        .fontSize(8.5)
        .font("Helvetica-Oblique")
        .text("Crew will safely dismount TVs from walls at origin and remount at destination if hardware is provided. Wall repair is not included.", margin, y, { width: usableWidth, lineGap: 1.5 });
      y = doc.y + 8;
      drawHRule(doc, y, margin);
      y += 12;
    }

    if (data.parkingInstructions && data.parkingInstructions.trim().length > 0) {
      y = sectionHeader(doc, "PARKING & DRIVER INSTRUCTIONS", y, margin);
      y += 4;
      doc
        .fillColor("#1e293b")
        .fontSize(9)
        .font("Helvetica")
        .text(data.parkingInstructions, margin, y, { width: usableWidth, lineGap: 1.5 });
      y = doc.y + 10;
      drawHRule(doc, y, margin);
      y += 12;
    }

    if (data.inventory && Object.keys(data.inventory).length > 0) {
      y = sectionHeader(doc, "LIST OF ITEMS", y, margin);
      y += 4;
      const items = Object.entries(data.inventory).filter(([, qty]) => qty > 0);
      for (const [item, qty] of items) {
        doc
          .fillColor("#1e293b")
          .fontSize(9)
          .font("Helvetica")
          .text(`• ${item}${qty > 1 ? ` (x${qty})` : ""}`, margin + 10, y, { width: usableWidth - 10 });
        y += 13;
      }
      y += 6;
      drawHRule(doc, y, margin);
      y += 12;
    }

    doc
      .fillColor("#94a3b8")
      .fontSize(8)
      .font("Helvetica-Oblique")
      .text("*Boxes will be provided by Teemer Moving & Storage Co. and will result in a small fee per box", margin, y);
    y += 14;

    if (data.additionalNotes) {
      y = sectionHeader(doc, "DESCRIPTION / NOTES", y, margin);
      y += 4;
      doc
        .fillColor(GRAY)
        .fontSize(9)
        .font("Helvetica")
        .text(data.additionalNotes, margin, y, { width: usableWidth, lineGap: 1.5 });
      y = doc.y + 10;
      drawHRule(doc, y, margin);
      y += 12;
    }

    if (y > 620) {
      doc.addPage();
      y = 50;
    }

    y = legalSection(doc, "DAMAGES", "Although our moving staff will be as careful as possible, from time to time damages may occur. If a damage is caused by our staff, at our discretion, we will repair the item or compensate for its depreciated value. Any fragile articles that are not packed and unpacked by Mover will only be moved at the owner's risk. Because the mechanical condition of electronics and appliances is unknown, we only assume responsibility for items which are mishandled or receive visible damage by our staff. We are not responsible for unprotected flooring. If due to an inherent weakness in a piece of furniture (i.e. defect, prior repair, unstable construction) a damage occurs, you understand that we will not be liable for any damage(s) to that piece. Mover is only responsible for items in their immediate care. Mover assumes no responsibility for money, jewelry, or other valuables; please make sure these items are safely put away before our crew arrives. Mover will not be responsible for claims not specified on this contract. Please inspect all goods prior to the crew arriving.", y, margin);

    y = legalSection(doc, "TERMS", "This contract shall remain in effect from the move date listed above until the completion of relocation of all items referenced on the Inventory List and delivery of payment in full to Teemer Moving and Storage Corp. If time taken to complete the move exceeds the anticipated time, we will charge for the additional hours of labor.", y, margin);

    y = legalSection(doc, "CONFIDENTIALITY", "Mover, and its employees or representatives will not at any time or in any manner, either directly or indirectly, use for the personal benefit of Client, or divulge, disclose, or communicate in any manner, any information that is proprietary to Client. Mover and its employees or representatives will protect such information and treat it as strictly confidential. This provision will continue to be effective after the termination of this Contract.", y, margin);

    y = legalSection(doc, "INDEMNIFICATION", "The client agrees to indemnify and hold harmless the moving company, its employees, and agents from any and all claims, damages, or liabilities arising from the client's own negligence, actions, or omissions. This includes, but is not limited to, damages resulting from the client's failure to properly prepare items for transport, providing inaccurate information, or interfering with the moving process. Furthermore, the client agrees to indemnify the moving company for damages caused by circumstances beyond the moving company's reasonable control, such as acts of nature, civil unrest, or defects in the client's property that are not discoverable by reasonable inspection. The moving company shall not be liable for any loss or damage unless it is directly caused by the moving company's gross negligence or willful misconduct.", y, margin);

    y = legalSection(doc, "PAYMENT", "Payment for the services listed under this contract can be made by any of the following options: Cash, Check or PayPal. Online payments will be charged a 5% processing fee. If any invoice is not paid when due, interest will be added to and payable on all overdue amounts at 5% per year, or the maximum percentage allowed under applicable laws, whichever is less. If the price exceeds the amount of $1,000, half payment is required before a move is booked. Weekend moves will be charged a fee of 5%.", y, margin);

    y = legalSection(doc, "CANCELLATIONS", "Mover requests 24 hour notice for last-minute appointments and 2 weeks notice for scheduled advanced appointments. If prior notice is not given, the client will be charged a late fee of $75 for the missed appointment.", y, margin);

    y = legalSection(doc, "WARRANTY", "Mover shall provide its services and meet its obligations under this Contract in a timely and workmanlike manner, using knowledge and recommendations for performing the services which meet generally acceptable standards in Mover's community and region, and will provide a standard of care equal to, or superior to, care used by movers similar to Mover on similar projects.", y, margin);

    if (y > 620) {
      doc.addPage();
      y = 50;
    }

    y += 10;
    doc
      .fillColor(NAVY)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("IN WITNESS WHEREOF, the parties have executed this Agreement as of the Move Date first written above.", margin, y, { width: usableWidth });
    y += 16;
    doc
      .fillColor(GRAY)
      .fontSize(9)
      .font("Helvetica-Oblique")
      .text("I accept the conditions stated above.", margin, y);
    y += 24;

    const sigBoxW = (usableWidth - 30) / 2;
    const leftX = margin;
    const rightX = margin + sigBoxW + 30;

    doc.rect(leftX, y, sigBoxW, 80).stroke("#e2e8f0");
    doc.rect(rightX, y, sigBoxW, 80).stroke("#e2e8f0");

    doc.fillColor(GRAY).fontSize(8).font("Helvetica")
      .text("[MOVER]", leftX + 8, y + 6)
      .text("[CLIENT]", rightX + 8, y + 6);

    doc.fillColor("#1e293b").fontSize(8)
      .text("Signature", leftX + 8, y + 54)
      .text("Signature", rightX + 8, y + 54);

    doc.strokeColor("#94a3b8").lineWidth(0.5)
      .moveTo(leftX + 8, y + 52).lineTo(leftX + sigBoxW - 8, y + 52).stroke()
      .moveTo(rightX + 8, y + 52).lineTo(rightX + sigBoxW - 8, y + 52).stroke();

    doc.fillColor("#1e293b").fontSize(8)
      .text("Date", leftX + 8, y + 70)
      .text("Date", rightX + 8, y + 70);

    doc.strokeColor("#94a3b8").lineWidth(0.5)
      .moveTo(leftX + 30, y + 70).lineTo(leftX + sigBoxW - 8, y + 70).stroke()
      .moveTo(rightX + 30, y + 70).lineTo(rightX + sigBoxW - 8, y + 70).stroke();

    y += 100;

    doc.addPage();
    y = 50;

    doc
      .rect(0, 0, pageW, 40)
      .fill("#f8fafc");
    doc
      .fillColor(NAVY)
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("EMPLOYEE ACKNOWLEDGMENT", margin, 12, { width: usableWidth, align: "center" });

    y = 52;
    doc
      .fillColor(GRAY)
      .fontSize(9)
      .font("Helvetica")
      .text("By printing and signing below, each employee confirms they have read and understood the terms of this contract.", margin, y, { width: usableWidth });
    y += 22;

    const empCols = [
      { label: "Print Name", x: margin, w: 160 },
      { label: "Signature", x: margin + 170, w: 200 },
      { label: "Date", x: margin + 380, w: 100 },
    ];

    doc.rect(margin, y, usableWidth, 18).fill(LIGHT_GRAY);
    for (const col of empCols) {
      doc.fillColor(NAVY).fontSize(8.5).font("Helvetica-Bold")
        .text(col.label, col.x + 4, y + 4, { width: col.w - 4 });
    }
    doc.strokeColor("#e2e8f0").lineWidth(0.5)
      .rect(margin, y, usableWidth, 18).stroke();
    y += 18;

    for (let i = 1; i <= 5; i++) {
      const rowY = y + (i - 1) * 36;
      doc.rect(margin, rowY, usableWidth, 36).stroke("#e2e8f0");
      doc.fillColor(GRAY).fontSize(7.5).font("Helvetica")
        .text(`Employee ${i}`, margin + 4, rowY + 4, { width: 50 });

      doc.strokeColor("#94a3b8").lineWidth(0.5)
        .moveTo(empCols[0].x + 4, rowY + 26).lineTo(empCols[0].x + empCols[0].w - 4, rowY + 26).stroke()
        .moveTo(empCols[1].x + 4, rowY + 26).lineTo(empCols[1].x + empCols[1].w - 4, rowY + 26).stroke()
        .moveTo(empCols[2].x + 4, rowY + 26).lineTo(empCols[2].x + empCols[2].w - 4, rowY + 26).stroke();

      for (const col of empCols) {
        doc.strokeColor("#e2e8f0").lineWidth(0.5)
          .moveTo(col.x + col.w, rowY).lineTo(col.x + col.w, rowY + 36).stroke();
      }
    }

    y += 5 * 36 + 20;

    doc.fillColor("#94a3b8").fontSize(8).font("Helvetica")
      .text(`Contract generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}  •  Teemer Moving & Storage Corp.  •  Long Beach, NY 11561`, margin, y, { width: usableWidth, align: "center" });

    doc.end();
  });
}
