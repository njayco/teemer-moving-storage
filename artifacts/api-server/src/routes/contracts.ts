import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contractsTable, jobsTable, quoteRequestsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { generateContractPdf, type ContractData } from "../lib/contract-pdf";
import { sendContractEmail } from "../lib/email-service";
import crypto from "node:crypto";

const router: IRouter = Router();

const ADMIN_CONTRACT_EMAIL = "alan@teemermoving.com";

function getBaseUrl(req: { hostname?: string }): string {
  return process.env.APP_BASE_URL
    || (process.env.REPLIT_DEPLOYMENT === "1"
      ? `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`
      : `https://${process.env.REPLIT_DEV_DOMAIN}`);
}

router.post("/jobs/:jobId/contracts", requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const [job] = await db
      .select()
      .from(jobsTable)
      .where(sql`${jobsTable.jobId} = ${String(jobId)} OR CAST(${jobsTable.id} AS TEXT) = ${String(jobId)}`)
      .limit(1);

    if (!job) return res.status(404).json({ error: "Job not found" });

    let quote = null;
    if (job.quoteId) {
      const [q] = await db.select().from(quoteRequestsTable).where(eq(quoteRequestsTable.id, job.quoteId)).limit(1);
      quote = q ?? null;
    }

    const customerEmail = quote?.email;
    if (!customerEmail) {
      return res.status(400).json({ error: "No customer email found for this job" });
    }

    const existing = await db.select().from(contractsTable).where(eq(contractsTable.jobId, job.id)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "A contract has already been generated for this job", contract: formatContract(existing[0]) });
    }

    const inventory = (job.inventoryJson ?? quote?.inventory ?? {}) as Record<string, number>;
    const contractData: ContractData = {
      customerName: quote?.contactName ?? job.customer ?? "Customer",
      customerPhone: quote?.phone ?? "",
      pickupAddress: job.originAddress ?? quote?.pickupAddress ?? quote?.originAddress ?? job.pickupLocation ?? "",
      pickupAddress2: quote?.secondStop ?? undefined,
      dropoffAddress: job.destinationAddress ?? quote?.dropoffAddress ?? quote?.destinationAddress ?? job.destination ?? "",
      crewSize: job.crewSize ?? quote?.crewSize ?? undefined,
      estimatedHours: job.estimatedHours ?? quote?.estimatedHours ?? undefined,
      moveDate: quote?.moveDate ?? job.dateTime ?? undefined,
      arrivalWindow: quote?.arrivalTimeWindow ?? job.arrivalWindow ?? undefined,
      inventory: Object.keys(inventory).length > 0 ? inventory : undefined,
      additionalNotes: quote?.additionalNotes ?? job.notes ?? undefined,
      jobId: job.jobId,
      quoteId: job.quoteId ?? undefined,
      totalEstimate: job.finalTotal ?? job.estimatedPayout ?? undefined,
      depositAmount: job.depositPaid ?? undefined,
    };

    const pdfBuffer = await generateContractPdf(contractData);

    const signingToken = crypto.randomUUID();

    const [contract] = await db.insert(contractsTable).values({
      jobId: job.id,
      quoteId: job.quoteId ?? null,
      signingToken,
      status: "sent",
      contractDataJson: contractData as unknown as Record<string, unknown>,
      sentAt: new Date(),
    }).returning();

    const baseUrl = getBaseUrl(req);
    const signingUrl = `${baseUrl}/sign/${signingToken}`;

    await sendContractEmail({
      to: customerEmail,
      customerName: contractData.customerName,
      moveDate: contractData.moveDate ?? "",
      signingUrl,
      pdfBuffer,
      jobId: job.id,
      quoteId: job.quoteId ?? null,
    });

    await sendContractEmail({
      to: ADMIN_CONTRACT_EMAIL,
      customerName: contractData.customerName,
      moveDate: contractData.moveDate ?? "",
      signingUrl,
      pdfBuffer,
      jobId: job.id,
      quoteId: job.quoteId ?? null,
      isAdminCopy: true,
    });

    res.status(201).json(formatContract(contract));
  } catch (err) {
    req.log.error({ err }, "Failed to generate contract");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/jobs/:jobId/contract", requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const [job] = await db
      .select({ id: jobsTable.id })
      .from(jobsTable)
      .where(sql`${jobsTable.jobId} = ${String(jobId)} OR CAST(${jobsTable.id} AS TEXT) = ${String(jobId)}`)
      .limit(1);

    if (!job) return res.status(404).json({ error: "Job not found" });

    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.jobId, job.id)).limit(1);
    if (!contract) return res.json(null);

    res.json(formatContract(contract));
  } catch (err) {
    req.log.error({ err }, "Failed to get contract");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/contracts/sign/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.signingToken, token)).limit(1);
    if (!contract) return res.status(404).json({ error: "Contract not found or link is invalid" });

    res.json({
      id: contract.id,
      status: contract.status,
      customerSignedAt: contract.customerSignedAt?.toISOString() ?? null,
      contractData: contract.contractDataJson,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get contract for signing");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/contracts/sign/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { signatureData } = req.body;

    if (!signatureData || typeof signatureData !== "string") {
      return res.status(400).json({ error: "signatureData is required" });
    }

    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.signingToken, token)).limit(1);
    if (!contract) return res.status(404).json({ error: "Contract not found or link is invalid" });

    if (contract.status === "signed") {
      return res.status(409).json({ error: "This contract has already been signed" });
    }

    const ip = req.headers["x-forwarded-for"]?.toString() ?? req.socket.remoteAddress ?? null;
    const now = new Date();

    await db.update(contractsTable)
      .set({
        status: "signed",
        customerSignatureData: signatureData,
        customerSignedAt: now,
        customerIpAddress: ip,
        updatedAt: now,
      })
      .where(eq(contractsTable.id, contract.id));

    res.json({ success: true, signedAt: now.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to sign contract");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/jobs/:jobId/contracts/pdf", requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const [job] = await db
      .select()
      .from(jobsTable)
      .where(sql`${jobsTable.jobId} = ${String(jobId)} OR CAST(${jobsTable.id} AS TEXT) = ${String(jobId)}`)
      .limit(1);

    if (!job) return res.status(404).json({ error: "Job not found" });

    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.jobId, job.id)).limit(1);

    let contractData: ContractData;
    if (contract?.contractDataJson) {
      contractData = contract.contractDataJson as unknown as ContractData;
    } else {
      let quote = null;
      if (job.quoteId) {
        const [q] = await db.select().from(quoteRequestsTable).where(eq(quoteRequestsTable.id, job.quoteId)).limit(1);
        quote = q ?? null;
      }
      const inventory = (job.inventoryJson ?? quote?.inventory ?? {}) as Record<string, number>;
      contractData = {
        customerName: quote?.contactName ?? job.customer ?? "Customer",
        customerPhone: quote?.phone ?? "",
        pickupAddress: job.originAddress ?? quote?.pickupAddress ?? job.pickupLocation ?? "",
        pickupAddress2: quote?.secondStop ?? undefined,
        dropoffAddress: job.destinationAddress ?? quote?.dropoffAddress ?? job.destination ?? "",
        crewSize: job.crewSize ?? quote?.crewSize ?? undefined,
        estimatedHours: job.estimatedHours ?? quote?.estimatedHours ?? undefined,
        moveDate: quote?.moveDate ?? job.dateTime ?? undefined,
        arrivalWindow: quote?.arrivalTimeWindow ?? job.arrivalWindow ?? undefined,
        inventory: Object.keys(inventory).length > 0 ? inventory : undefined,
        additionalNotes: quote?.additionalNotes ?? job.notes ?? undefined,
        jobId: job.jobId,
        quoteId: job.quoteId ?? undefined,
      };
    }

    const pdfBuffer = await generateContractPdf(contractData);
    const filename = `Teemer-Contract-${job.jobId || job.id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    req.log.error({ err }, "Failed to generate contract PDF");
    res.status(500).json({ error: "Internal server error" });
  }
});

function formatContract(c: typeof contractsTable.$inferSelect) {
  return {
    id: c.id,
    jobId: c.jobId,
    quoteId: c.quoteId,
    signingToken: c.signingToken,
    status: c.status,
    sentAt: c.sentAt?.toISOString() ?? null,
    customerSignedAt: c.customerSignedAt?.toISOString() ?? null,
    customerSignatureData: c.customerSignatureData ?? null,
    createdAt: c.createdAt?.toISOString() ?? null,
    updatedAt: c.updatedAt?.toISOString() ?? null,
  };
}

export default router;
