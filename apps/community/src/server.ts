import { ChannelType, type Guild, type Role, type TextChannel } from "discord.js";
import { CHANNELS, ROLES, type ChannelKey, type RoleKey } from "./config";
import type { Links } from "./content";
import { env } from "./env";
import { log } from "./runtime";

/** Looks up the configured channels and roles in the community server by name. */
export class Server {
  constructor(readonly guild: Guild) {}

  channel(key: ChannelKey): TextChannel | null {
    const name = CHANNELS[key];
    const c = this.guild.channels.cache.find((ch) => ch.name === name && (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement));
    return (c as TextChannel | undefined) ?? null;
  }

  role(key: RoleKey): Role | null {
    return this.guild.roles.cache.find((r) => r.name === ROLES[key]) ?? null;
  }

  links(): Links {
    return {
      app: env.APP_URL,
      channel: (key) => {
        const c = this.channel(key);
        return c ? `<#${c.id}>` : `#${CHANNELS[key]}`;
      },
    };
  }

  /** Logs every configured channel or role that does not exist, so a typo is obvious. */
  reportMissing() {
    const channels = (Object.keys(CHANNELS) as ChannelKey[]).filter((k) => !this.channel(k)).map((k) => CHANNELS[k]);
    const roles = (Object.keys(ROLES) as RoleKey[]).filter((k) => !this.role(k)).map((k) => ROLES[k]);
    if (channels.length || roles.length) log.warn({ channels, roles }, "configured channels/roles not found — related features are disabled");
  }
}
