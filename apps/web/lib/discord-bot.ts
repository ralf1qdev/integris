import "server-only";
import { DISCORD_API, type RawDiscordWebhook } from "@integris/shared";
import { env } from "./env";

export class DiscordBotError extends Error {
  constructor(
    public status: number,
    public code: number | null,
  ) {
    super(`Discord API error ${status}${code ? ` (${code})` : ""}`);
  }
}

/** Bot-token request with a single honoured retry on 429. The token never leaves the server. */
async function botRequest(method: string, path: string, reason?: string): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${DISCORD_API}${path}`, {
      method,
      headers: {
        Authorization: `Bot ${env().DISCORD_BOT_TOKEN}`,
        ...(reason ? { "X-Audit-Log-Reason": encodeURIComponent(reason.slice(0, 512)) } : {}),
      },
      cache: "no-store",
    });
    if (res.status === 429 && attempt === 0) {
      const retry = Number(res.headers.get("retry-after") ?? "1");
      await new Promise((r) => setTimeout(r, Math.min(Math.max(retry, 0.2), 5) * 1000));
      continue;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { code?: number };
      throw new DiscordBotError(res.status, body.code ?? null);
    }
    return res;
  }
  throw new DiscordBotError(429, null);
}

/** Returns only the guild a webhook belongs to; the token in the response is discarded immediately. */
export async function getWebhookGuildId(webhookId: string): Promise<string | null> {
  const res = await botRequest("GET", `/webhooks/${webhookId}`);
  const raw = (await res.json()) as RawDiscordWebhook;
  return raw.guild_id ?? null;
}

export async function deleteWebhook(webhookId: string, reason: string): Promise<void> {
  await botRequest("DELETE", `/webhooks/${webhookId}`, reason);
}
