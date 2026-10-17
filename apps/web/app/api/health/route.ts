import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const [database, cache] = await Promise.all([
    db.$queryRaw`SELECT 1`.then(() => "ok").catch(() => "down"),
    redis().ping().then(() => "ok").catch(() => "down"),
  ]);
  const ok = database === "ok" && cache === "ok";
  return Response.json({ status: ok ? "ok" : "degraded", database, redis: cache }, { status: ok ? 200 : 503 });
}
