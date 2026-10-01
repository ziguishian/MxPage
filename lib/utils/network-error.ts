// SDKs wrap fetch errors; Windows may put the socket error inside AggregateError.
// Inspect codes only, never serialize request headers or provider response bodies.
export function networkErrorCode(error: unknown): string | undefined {
  const pending: unknown[] = [error];
  const seen = new Set<object>();
  let fallback: string | undefined;
  for (let visited = 0; pending.length && visited < 32; visited++) {
    const value = pending.shift();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    const item = value as { code?: unknown; cause?: unknown; errors?: unknown };
    if (item.code === "EACCES" || item.code === "EPERM") return item.code;
    if (typeof item.code === "string" && /^(ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|UND_ERR_SOCKET)$/.test(item.code)) fallback ??= item.code;
    if (item.cause) pending.push(item.cause);
    if (Array.isArray(item.errors)) pending.push(...item.errors.slice(0, 8));
  }
  return fallback;
}
