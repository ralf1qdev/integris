import { Permission, type ChannelInfo, type GuildContext, type RoleInfo } from "../src/permissions";

export const GUILD = "100000000000000000";
export const OWNER = "100000000000000001";
export const BOT = "200000000000000000";

export function role(id: string, name: string, position: number, perms: bigint, extra: Partial<RoleInfo> = {}): RoleInfo {
  return { id, name, position, permissions: perms.toString(), managed: false, ...extra };
}

export function ctx(roles: RoleInfo[], channels: ChannelInfo[] = []): GuildContext {
  return {
    guildId: GUILD,
    ownerId: OWNER,
    roles: [role(GUILD, "@everyone", 0, Permission.ViewChannel | Permission.SendMessages), ...roles],
    channels,
  };
}
