/** Utilidades HTTP compartidas por todas las funciones de /api. */

export interface Req {
  method?: string;
  headers: Record<string, any>;
  body?: any;
  query?: Record<string, any>;
  cookies?: Record<string, string>;
  url?: string;
}

/**
 * El objeto de respuesta NO es igual en los dos runtimes:
 *   - scripts/dev-api.ts (local): trae status() y json()
 *   - Vercel / Node nativo:       statusCode + setHeader + end
 * Por eso status/json se declaran opcionales y siempre se comprueba su tipo.
 */
export interface Res {
  status?(code: number): Res;
  json?(body: any): void;
  setHeader(name: string, value: any): void;
  end?(chunk?: any): void;
  statusCode?: number;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}

/**
 * Responde JSON en los dos runtimes.
 * Si se asume solo el shim local, en Vercel `res.status` no existe, la excepción
 * salta DENTRO del catch de run() y la función muere con
 * FUNCTION_INVOCATION_FAILED (texto plano, 500).
 */
export function json(res: Res, status: number, body: any): void {
  const r: any = res;
  if (typeof r.status === 'function' && typeof r.json === 'function') {
    r.status(status).json(body);
    return;
  }
  if (typeof r.setHeader === 'function') r.setHeader('Content-Type', 'application/json; charset=utf-8');
  r.statusCode = status;
  if (typeof r.end === 'function') r.end(JSON.stringify(body));
}

/** CORS explícito: la app y la API viven en el mismo dominio, pero en local usamos proxy. */
export function setCors(req: Req, res: Res): void {
  const origin = String(req.headers?.origin || '');
  const allowed = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.length === 0 || allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  (header || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

export function serializeCookie(
  name: string,
  value: string,
  opts: { maxAge?: number; httpOnly?: boolean; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none'; path?: string } = {}
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? '/'}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.secure !== false) parts.push('Secure');
  parts.push(`SameSite=${(opts.sameSite ?? 'lax').replace(/^./, c => c.toUpperCase())}`);
  return parts.join('; ');
}

/** Cookies Secure no viajan por http:// → en local se omiten, si no el login nunca "pega". */
export function cookieOptions(maxAgeSeconds: number) {
  const isLocal = (process.env.APP_URL || '').startsWith('http://');
  return { maxAge: maxAgeSeconds, httpOnly: true, secure: !isLocal, sameSite: 'lax' as const, path: '/' };
}

export function requireBody(req: Req): any {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { throw new HttpError(400, 'JSON inválido'); }
  }
  return req.body;
}

export function metodoPermitido(req: Req, res: Res, permitidos: string[]): boolean {
  if (req.method === 'OPTIONS') {
    const r: any = res;
    if (typeof r.status === 'function') { r.status(204).end(); }
    else { r.statusCode = 204; if (typeof r.end === 'function') r.end(); }
    return false;
  }
  if (!permitidos.includes(String(req.method))) {
    json(res, 405, { ok: false, error: 'Método no permitido' });
    return false;
  }
  return true;
}

export function hoyISO(tz = process.env.APP_TIMEZONE || 'America/Mexico_City'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}
