/** Pure helpers, unit-tested without Discord. */

export function ticketThreadName(number: number, username: string): string {
  const clean = username.replace(/[^\p{L}\p{N}_.-]/gu, "").slice(0, 32) || "user";
  return `ticket-${String(number).padStart(4, "0")}-${clean}`.toLowerCase();
}

/** The opener, or anyone who can manage threads (Support, Moderator, Team), may close a ticket. */
export function canCloseTicket(input: { userId: string; openerId: string; canManageThreads: boolean }): boolean {
  return input.userId === input.openerId || input.canManageThreads;
}

export function formatDuration(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}

/** Sliding-window counter used to pause welcome posts during join raids. */
export class BurstGuard {
  private hits: number[] = [];
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Records an event and returns true while the burst limit is not exceeded. */
  allow(now = Date.now()): boolean {
    this.hits = this.hits.filter((t) => now - t < this.windowMs);
    this.hits.push(now);
    return this.hits.length <= this.max;
  }
}
