import { EMBED_COLORS } from "@integris/shared";
import type { APIEmbed } from "discord.js";
import { TICKET_CATEGORIES, type ChannelKey } from "./config";

/**
 * Copy for the information channels. Each post has a stable key; the bot edits its
 * previous post with the same key instead of posting duplicates.
 */
export const POSTS = {
  "welcome-intro": { channel: "welcome", label: "Start here" },
  rules: { channel: "rules", label: "Server rules" },
  about: { channel: "about", label: "About Integris" },
  faq: { channel: "faq", label: "FAQ" },
  "help-panel": { channel: "help", label: "Support" },
} as const satisfies Record<string, { channel: ChannelKey; label: string }>;

export type PostKey = keyof typeof POSTS;
export const isPostKey = (v: string): v is PostKey => v in POSTS;

export interface Links {
  app: string;
  /** Renders a channel mention, or #name if the channel is missing. */
  channel: (key: ChannelKey) => string;
}

export const footerFor = (key: PostKey) => `Integris · ${POSTS[key].label}`;

export function postEmbeds(key: PostKey, l: Links): APIEmbed[] {
  const footer = { text: footerFor(key) };
  switch (key) {
    case "welcome-intro":
      return [
        {
          color: EMBED_COLORS.brand,
          title: "Welcome to the Integris community",
          description:
            "Integris is a Discord security platform for everything connected to your server — bots, webhooks and the permissions they hold.\n\nHere's how to find your way around:",
          fields: [
            { name: "📌 Start here", value: `${l.channel("rules")} — the rules\n${l.channel("about")} — what Integris does\n${l.channel("faq")} — common questions` },
            { name: "📣 Stay updated", value: `${l.channel("announcements")} — news\n${l.channel("changelog")} — every release\n${l.channel("status")} — incidents and maintenance` },
            { name: "🛟 Get help", value: `Open a private ticket in ${l.channel("help")}. Our Support team will join you there.` },
            { name: "💬 Hang out", value: `${l.channel("general")} · ${l.channel("showcase")} · ${l.channel("suggestions")}` },
          ],
          footer,
        },
      ];

    case "rules":
      return [
        {
          color: EMBED_COLORS.brand,
          title: "Server rules",
          description: [
            "**1. Be respectful.** No harassment, hate speech, discrimination or personal attacks.",
            "**2. Keep it safe for work.** No NSFW, gore or shock content anywhere, including names and avatars.",
            "**3. No spam or self-promotion.** No advertising, unsolicited DMs, invite links or repeated messages.",
            `**4. Use the right channel.** Support goes in ${l.channel("help")} tickets, ideas in ${l.channel("suggestions")}, bot commands in ${l.channel("botCmds")}.`,
            "**5. Never share secrets.** Bot tokens, webhook URLs, OAuth secrets and passwords stay private. Integris staff will **never** ask for them — report anyone who does.",
            "**6. Report vulnerabilities privately.** Open a *Security report* ticket. Do not post security issues in public channels.",
            "**7. No impersonation.** Only members with the Integris Team, Moderator or Support roles speak for Integris.",
            "**8. Follow Discord's rules.** The [Terms of Service](https://discord.com/terms) and [Community Guidelines](https://discord.com/guidelines) apply here.",
          ].join("\n\n"),
          fields: [{ name: "Enforcement", value: "Moderators may remove content, time out, kick or ban at their discretion. Questions about a decision? Open a ticket — don't argue it out in public." }],
          footer,
        },
      ];

    case "about":
      return [
        {
          color: EMBED_COLORS.brand,
          title: "About Integris",
          description: "**Security for everything connected to your Discord.**\n\nMost server compromises don't start with a member — they start with an integration: a bot with too much power, a leaked webhook, a role quietly given Administrator. Integris watches exactly that.",
          fields: [
            { name: "🤖 Bot security", value: "Every bot's *effective* permissions, calculated from roles, the role hierarchy and channel overwrites. Alerts when a bot gains power." },
            { name: "🔗 Webhook protection", value: "An inventory of every webhook, approval for the ones you know, protected webhooks, restricted channels and a confirmed emergency delete." },
            { name: "🚨 Security alerts", value: "Deduplicated alerts with evidence and a recommended response, in the dashboard and your staff channel — acknowledge or resolve right from Discord." },
            {
              name: "🧭 What it doesn't do",
              value: "It never bans or removes bots automatically, never reads message content, and never claims to see inside other bots or to count webhook messages Discord doesn't expose.",
            },
            { name: "🚀 Get started", value: `1. [Add Integris](${l.app}/invite) to your server\n2. Sign in to the [dashboard](${l.app}/dashboard)\n3. Run \`/setup\` to choose an alert channel` },
            { name: "🔗 Links", value: `[Website](${l.app}) · [Docs](${l.app}/docs) · [Status](${l.app}/status)` },
          ],
          footer,
        },
      ];

    case "faq":
      return [
        {
          color: EMBED_COLORS.brand,
          title: "Frequently asked questions",
          fields: [
            { name: "Is Integris free?", value: "Yes — every feature is free during the beta." },
            {
              name: "What permissions does it need?",
              value: "View Audit Log, View Channels, Send Messages, Embed Links and Manage Webhooks. Never Administrator. Discord only lists webhooks to members with Manage Webhooks, which is why it's required.",
            },
            { name: "Will it ban or remove bots?", value: "No. Integris reports risk; you decide. The only destructive action is deleting a webhook, and only after you confirm it by typing its name." },
            { name: "Does it read our messages?", value: "No. Integris does not use the message content intent and stores no messages." },
            { name: "Who can see my server's dashboard?", value: "Only the owner and members with Administrator or Manage Server — checked with Discord on every request." },
            { name: "Why does a bot show as \"High risk\"?", value: "Because of what it is *allowed* to do, not because it's malicious. Review the finding, then mark the bot as trusted if the access is intended." },
            { name: "The Bots page is empty", value: "The Integris application needs the Server Members intent. If you self-host, enable it in the Developer Portal; on the hosted bot, open a ticket." },
            { name: "How do I delete my data?", value: `Dashboard → Settings → *Delete server data*. Details in the [docs](${l.app}/docs#data-deletion).` },
            { name: "Still stuck?", value: `Open a ticket in ${l.channel("help")}.` },
          ],
          footer,
        },
      ];

    case "help-panel":
      return [
        {
          color: EMBED_COLORS.brand,
          title: "Need help with Integris?",
          description: `Choose a topic below to open a **private ticket**. Only you and our staff can see it.\n\nBefore opening one, check ${l.channel("faq")} and the [docs](${l.app}/docs).`,
          fields: [
            ...Object.values(TICKET_CATEGORIES).map((c) => ({ name: `${c.emoji} ${c.label}`, value: c.description, inline: true })),
            { name: "Please never share", value: "Bot tokens, webhook URLs or passwords — staff will never ask for them." },
          ],
          footer,
        },
      ];
  }
}
