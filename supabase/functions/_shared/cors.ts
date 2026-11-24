/** CORS restricted to the origins listed in the ALLOWED_ORIGINS secret (comma-separated). */
export function allowedOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const list = allowedOrigins();
  const allow = origin && list.includes(origin) ? origin : list[0] ?? 'null';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function isOriginAllowed(origin: string | null): boolean {
  const list = allowedOrigins();
  if (list.length === 0) return true; // not configured (local dev) — documented as required in production
  return origin !== null && list.includes(origin);
}
