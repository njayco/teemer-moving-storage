import { db } from "@workspace/db";
import { jobStatusEventsTable } from "@workspace/db/schema";
import { logger } from "./logger";

export interface RecordTimelineEventParams {
  jobId: number;
  eventType: string;
  statusLabel?: string;
  visibleToCustomer?: boolean;
  notes?: string;
  createdByUserId?: number;
}

export async function recordTimelineEvent(params: RecordTimelineEventParams) {
  try {
    const [event] = await db
      .insert(jobStatusEventsTable)
      .values({
        jobId: params.jobId,
        eventType: params.eventType,
        statusLabel: params.statusLabel ?? null,
        visibleToCustomer: params.visibleToCustomer ?? true,
        notes: params.notes ?? null,
        createdByUserId: params.createdByUserId ?? null,
      })
      .returning();

    logger.info(
      { jobId: params.jobId, eventType: params.eventType },
      "Timeline event recorded"
    );

    return event;
  } catch (err) {
    logger.error(
      { err, jobId: params.jobId, eventType: params.eventType },
      "Failed to record timeline event"
    );
    return null;
  }
}
