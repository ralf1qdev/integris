import type { CommunityTicket } from "@prisma/client";
import { isUniqueViolation, type Db } from "../client";

export async function findOpenTicket(db: Db, guildId: string, openerId: string) {
  return db.communityTicket.findFirst({ where: { guildId, openerId, status: "OPEN" } });
}

/**
 * Reserves the next ticket number for a guild. The thread is created after the
 * number is known, so the row starts with a placeholder threadId that is replaced
 * by attachTicketThread. Concurrent reservations retry on the unique constraint.
 */
export async function reserveTicket(
  db: Db,
  input: { guildId: string; openerId: string; openerName: string; category: string; subject: string },
): Promise<CommunityTicket> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await db.communityTicket.findFirst({ where: { guildId: input.guildId }, orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;
    try {
      return await db.communityTicket.create({ data: { ...input, number, threadId: `pending:${input.guildId}:${number}` } });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error("Could not allocate a ticket number");
}

export async function attachTicketThread(db: Db, ticketId: string, threadId: string) {
  return db.communityTicket.update({ where: { id: ticketId }, data: { threadId } });
}

export async function discardTicket(db: Db, ticketId: string) {
  await db.communityTicket.delete({ where: { id: ticketId } }).catch(() => {});
}

export async function getTicketByThread(db: Db, guildId: string, threadId: string) {
  return db.communityTicket.findFirst({ where: { guildId, threadId } });
}

/** Closes an open ticket. Returns null if it was already closed (idempotent for double clicks). */
export async function closeTicket(db: Db, input: { guildId: string; threadId: string; closedById: string }) {
  const { count } = await db.communityTicket.updateMany({
    where: { guildId: input.guildId, threadId: input.threadId, status: "OPEN" },
    data: { status: "CLOSED", closedAt: new Date(), closedById: input.closedById },
  });
  if (!count) return null;
  return db.communityTicket.findFirstOrThrow({ where: { guildId: input.guildId, threadId: input.threadId } });
}
