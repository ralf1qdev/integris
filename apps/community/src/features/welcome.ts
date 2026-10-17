import { EMBED_COLORS } from "@integris/shared";
import type { GuildMember } from "discord.js";
import { JOIN_BURST } from "../config";
import { BurstGuard } from "../helpers";
import { log } from "../runtime";
import type { Server } from "../server";

const guard = new BurstGuard(JOIN_BURST.max, JOIN_BURST.windowMs);

/** Gives new members the Member role and greets them in #welcome. */
export async function onMemberJoin(server: Server, member: GuildMember) {
  if (member.user.bot) return;

  const role = server.role("member");
  if (role) await member.roles.add(role, "New member").catch((err) => log.warn({ err, userId: member.id }, "could not add Member role"));

  const channel = server.channel("welcome");
  if (!channel) return;
  if (!guard.allow()) {
    log.warn({ userId: member.id }, "join burst detected — welcome message skipped");
    return;
  }
  const l = server.links();
  await channel.send({
    content: `Welcome, ${member}!`,
    embeds: [
      {
        color: EMBED_COLORS.brand,
        author: { name: member.user.username, icon_url: member.user.displayAvatarURL({ size: 64 }) },
        description: `Glad you're here — you're member **#${member.guild.memberCount}**.\n\nStart with ${l.channel("rules")} and ${l.channel("about")}. Need a hand with Integris? Open a ticket in ${l.channel("help")}.`,
      },
    ],
    allowedMentions: { users: [member.id] },
  });
}
