/** Only same-site relative paths may be used as a post-login destination (prevents open redirects). */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\r\n]/.test(value)) return "/dashboard";
  return value.slice(0, 200);
}
