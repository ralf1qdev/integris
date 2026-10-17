/**
 * The community server layout, matched by name. Rename here if you rename a
 * channel or role in Discord. Features whose channel or role is missing are
 * disabled and a warning is logged at startup.
 */
export const CHANNELS = {
  welcome: "welcome",
  rules: "rules",
  about: "about-integris",
  announcements: "announcements",
  changelog: "changelog",
  status: "status",
  help: "help",
  faq: "faq",
  general: "general",
  showcase: "showcase",
  suggestions: "suggestions",
  botCmds: "bot-cmds",
  modLog: "mod-log",
} as const;

export const ROLES = {
  member: "Member",
  support: "Support",
  moderator: "Moderator",
  team: "Integris Team",
} as const;

export const SUGGESTION_REACTIONS = ["👍", "👎"] as const;

/** More joins than this inside the window are treated as a raid: roles are still given, welcome posts pause. */
export const JOIN_BURST = { max: 8, windowMs: 30_000 } as const;

export type ChannelKey = keyof typeof CHANNELS;
export type RoleKey = keyof typeof ROLES;

export const TICKET_CATEGORIES = {
  setup: { label: "Setup help", emoji: "🛠️", staff: "support", description: "Adding Integris, permissions, alert channel" },
  bug: { label: "Report a bug", emoji: "🐞", staff: "support", description: "Something in the bot or dashboard is broken" },
  question: { label: "Question", emoji: "💬", staff: "support", description: "Anything else about Integris" },
  security: { label: "Security report", emoji: "🔒", staff: "team", description: "Vulnerabilities — seen only by the Integris Team" },
} as const satisfies Record<string, { label: string; emoji: string; staff: RoleKey; description: string }>;

export type TicketCategory = keyof typeof TICKET_CATEGORIES;
export const isTicketCategory = (v: string): v is TicketCategory => v in TICKET_CATEGORIES;
