import { db } from "@/lib/db";
import { decryptSecret } from "@integris/database/crypto";
import { revokeToken } from "@/lib/discord-oauth";
import { env } from "@/lib/env";
import { destroySession, getSession, verifyCsrf } from "@/lib/session";
import { apiError, json } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return json({ ok: true });
  if (!verifyCsrf(request, session.token)) return apiError(403, "csrf_failed", "Request verification failed.");
  const account = await db.account.findUnique({ where: { userId: session.user.id } });
  const remaining = await db.session.count({ where: { userId: session.user.id, id: { not: session.sessionId } } });
  await destroySession();
  // Signing out of the last session also revokes Integris' Discord access token.
  if (account && remaining === 0) {
    try {
      await revokeToken(decryptSecret(account.accessTokenEnc, env().ENCRYPTION_KEY, `access:${session.user.id}`));
    } catch {
      // Undecryptable (rotated key): nothing to revoke.
    }
    await db.account.delete({ where: { userId: session.user.id } }).catch(() => {});
  }
  return json({ ok: true });
}
