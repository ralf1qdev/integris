import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { getSystemStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function GET() {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`status:${ip}`, 60, 60, true);
  if (!rl.allowed) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });
  const status = await getSystemStatus();
  return Response.json(status, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}
