import { EMBED_COLORS } from "@integris/shared";
import { FOOTER, SEVERITY_COLOR, SEVERITY_LABEL, truncate, type Embed } from "@integris/shared/embeds";
import type { Severity } from "@integris/shared";

export { SEVERITY_COLOR, SEVERITY_LABEL, truncate };

export function embed(title: string, description?: string, color: number = EMBED_COLORS.brand): Embed {
  return { title, description, color, footer: { text: FOOTER }, timestamp: new Date().toISOString() };
}

const DOT: Record<Severity, string> = { INFO: "▫️", LOW: "⚪", MEDIUM: "🟡", HIGH: "🟠", CRITICAL: "🔴" };
export const severityTag = (s: Severity) => `${DOT[s]} ${SEVERITY_LABEL[s]}`;

export const relative = (d: Date | null | undefined) => (d ? `<t:${Math.floor(d.getTime() / 1000)}:R>` : "Never");

export function errorEmbed(message: string): Embed {
  return embed("Something went wrong", message, EMBED_COLORS.critical);
}
