import { PrismaClient } from "@prisma/client";

export const TEST_DB_URL = process.env.DATABASE_URL_TEST ?? "";
export const hasTestDb = TEST_DB_URL.length > 0;

export function testClient(): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
}

export async function resetDb(db: PrismaClient) {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  }
}

export const GUILD_A = "111111111111111111";
export const GUILD_B = "222222222222222222";
export const USER = "333333333333333333";
export const OTHER_USER = "444444444444444444";

export const MANAGE_GUILD = (1n << 5n).toString();
export const ADMINISTRATOR = (1n << 3n).toString();
export const SEND_MESSAGES = (1n << 11n).toString();

export async function seedGuild(db: PrismaClient, id: string, name: string, botPresent = true) {
  await db.guild.create({ data: { id, name, botPresent, installedAt: new Date() } });
  await db.guildSettings.create({ data: { guildId: id } });
}

export async function seedUser(db: PrismaClient, id: string) {
  await db.user.create({ data: { id, username: `user-${id.slice(0, 4)}` } });
}
