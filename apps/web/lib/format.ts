const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

export function timeAgo(date: Date | string | null | undefined, now = Date.now()): string {
  if (!date) return "Never";
  const seconds = Math.round((new Date(date).getTime() - now) / 1000);
  if (Math.abs(seconds) < 30) return "just now";
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "Unknown";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(date)) + " UTC";
}

