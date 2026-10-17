/** Integris brand tokens shared by the dashboard and Discord embeds. */
export const BRAND = {
  name: "Integris",
  tagline: "Security for everything connected to your Discord.",
  colors: {
    background: "#090B10",
    surface: "#11151D",
    primary: "#5865F2",
    secondary: "#818CF8",
    healthy: "#22C55E",
    warning: "#F59E0B",
    critical: "#EF4444",
    muted: "#8B93A7",
  },
} as const;

/** Embed accent colors as integers (Discord API format). */
export const EMBED_COLORS = {
  brand: 0x5865f2,
  healthy: 0x22c55e,
  info: 0x818cf8,
  low: 0x8b93a7,
  warning: 0xf59e0b,
  high: 0xf97316,
  critical: 0xef4444,
  resolved: 0x3f475a,
} as const;
