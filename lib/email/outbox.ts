import type { Prisma } from "../../generated/prisma/client";
import { getDatabase } from "../database";
import { getPublicAppUrl } from "../mercado-pago/config";
import { isEmailDriverReady, sendEmail } from "./driver";
import { renderOrderEmail } from "./templates";

export const EMAIL_PROCESSING_LEASE_MS = 15 * 60 * 1000;

export function getEmailProcessingLeaseCutoff(now: Date) {
  return new Date(now.getTime() - EMAIL_PROCESSING_LEASE_MS);
}

export function getEmailOutboxCandidateWhere(now: Date): Prisma.EmailOutboxWhereInput {
  const leaseExpiredAt = getEmailProcessingLeaseCutoff(now);
  return {
    attempts: { lt: 5 },
    OR: [
      { status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: now } },
      { status: "PROCESSING", updatedAt: { lte: leaseExpiredAt } },
    ],
  };
}

function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  return message.replace(/[^A-Z0-9_-]/gi, "_").slice(0, 80);
}

export async function processEmailOutbox(now = new Date(), batchSize = 20) {
  if (!isEmailDriverReady()) return { disabled: true, scanned: 0, sent: 0, failed: 0 };
  const database = getDatabase();
  const candidateWhere = getEmailOutboxCandidateWhere(now);
  const candidates = await database.emailOutbox.findMany({
    where: candidateWhere,
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: { id: true },
  });
  let sent = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const claimed = await database.emailOutbox.updateMany({
      where: { id: candidate.id, ...candidateWhere },
      data: { status: "PROCESSING", attempts: { increment: 1 }, lastErrorCode: null },
    });
    if (claimed.count !== 1) continue;

    const event = await database.emailOutbox.findUnique({
      where: { id: candidate.id },
      include: {
        store: { select: { name: true } },
        order: {
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
            totalCents: true,
            deliveryMethod: true,
          },
        },
      },
    });
    if (!event?.order.customerEmail) {
      await database.emailOutbox.update({
        where: { id: candidate.id },
        data: { status: "FAILED", attempts: 5, lastErrorCode: "RECIPIENT_MISSING" },
      });
      failed += 1;
      continue;
    }

    try {
      const orderUrl = `${getPublicAppUrl()}/pedido/${event.order.id}`;
      const template = renderOrderEmail(event.type, event.order, event.store.name, orderUrl);
      await sendEmail({ ...template, to: event.order.customerEmail, eventId: event.id });
      await database.emailOutbox.update({
        where: { id: event.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      sent += 1;
    } catch (error) {
      const retryMinutes = Math.min(60, 2 ** event.attempts);
      await database.emailOutbox.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          lastErrorCode: errorCode(error),
          nextAttemptAt: new Date(now.getTime() + retryMinutes * 60 * 1000),
        },
      });
      failed += 1;
    }
  }
  return { disabled: false, scanned: candidates.length, sent, failed };
}
