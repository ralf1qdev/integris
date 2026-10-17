"use client";

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

/** Same-origin API call carrying the CSRF token. Throws ApiError with a user-facing message. */
export async function api<T = unknown>(path: string, init: { method: string; body?: unknown } = { method: "GET" }): Promise<T> {
  const csrf = readCookie("__Host-integris_csrf") ?? readCookie("integris_csrf") ?? "";
  const res = await fetch(path, {
    method: init.method,
    credentials: "same-origin",
    headers: {
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      "X-Integris-CSRF": csrf,
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { code: string; message: string; fields?: { path: string; message: string }[] } };
  if (!res.ok) {
    throw new ApiError(res.status, data.error?.code ?? "error", data.error?.message ?? `Request failed (${res.status})`, data.error?.fields);
  }
  return data as T;
}
