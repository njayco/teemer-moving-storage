import { db } from "@workspace/db";
import { emailLogsTable } from "@workspace/db/schema";
import { and, gte, inArray, sql } from "drizzle-orm";

const WINDOW_MS = 60 * 60 * 1000;

const THROTTLED_EMAIL_TYPES = ["email_verification", "password_reset"] as const;
const THROTTLED_STATUSES = ["sent", "skipped"];

function getEmailRatePerHour(): number {
  const raw = process.env.AUTH_EMAIL_RATE_PER_HOUR;
  if (raw == null || raw === "") return 3;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
}

function getIpRatePerHour(): number {
  const raw = process.env.AUTH_IP_RATE_PER_HOUR;
  if (raw == null || raw === "") return 10;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
}

const ipHits = new Map<string, number[]>();

function recordIpHit(ip: string): number {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const arr = ipHits.get(ip) ?? [];
  const recent = arr.filter((t) => t >= cutoff);
  recent.push(now);
  ipHits.set(ip, recent);
  return recent.length;
}

function countIpHits(ip: string): number {
  const cutoff = Date.now() - WINDOW_MS;
  const arr = ipHits.get(ip) ?? [];
  const recent = arr.filter((t) => t >= cutoff);
  if (recent.length === 0) ipHits.delete(ip);
  else ipHits.set(ip, recent);
  return recent.length;
}

async function countRecipientEmails(recipient: string): Promise<number> {
  const since = new Date(Date.now() - WINDOW_MS);
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(emailLogsTable)
    .where(
      and(
        sql`lower(${emailLogsTable.recipient}) = ${recipient.toLowerCase()}`,
        inArray(emailLogsTable.emailType, [...THROTTLED_EMAIL_TYPES]),
        inArray(emailLogsTable.status, THROTTLED_STATUSES),
        gte(emailLogsTable.sentAt, since),
      ),
    );
  return rows[0]?.n ?? 0;
}

export type ThrottleScope = "ip" | "recipient";

export interface ThrottleDecision {
  allowed: boolean;
  scope?: ThrottleScope;
  count?: number;
  limit?: number;
}

/**
 * Decide whether an auth-related email send should be allowed for this
 * (ip, recipient) pair. Per-recipient counts are read durably from
 * `email_logs`; per-IP counts use an in-process sliding window.
 *
 * The IP counter is only incremented when this returns `allowed: true`, so
 * already-throttled callers don't keep extending their own ban.
 */
export async function checkAuthEmailRate(opts: {
  ip: string | undefined;
  recipient: string;
}): Promise<ThrottleDecision> {
  const ip = (opts.ip ?? "unknown").trim() || "unknown";
  const recipient = opts.recipient.trim().toLowerCase();

  const emailLimit = getEmailRatePerHour();
  const ipLimit = getIpRatePerHour();

  const ipCount = countIpHits(ip);
  if (ipCount >= ipLimit) {
    return { allowed: false, scope: "ip", count: ipCount, limit: ipLimit };
  }

  const recipientCount = await countRecipientEmails(recipient);
  if (recipientCount >= emailLimit) {
    return {
      allowed: false,
      scope: "recipient",
      count: recipientCount,
      limit: emailLimit,
    };
  }

  const newIpCount = recordIpHit(ip);
  return { allowed: true, count: newIpCount, limit: ipLimit };
}

/** Test-only helper to clear the in-memory IP window between tests. */
export function __resetIpHitsForTests(): void {
  ipHits.clear();
}
