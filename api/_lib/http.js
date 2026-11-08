"use strict";
/** Utilidades HTTP compartidas por todas las funciones de /api. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = void 0;
exports.json = json;
exports.setCors = setCors;
exports.parseCookies = parseCookies;
exports.serializeCookie = serializeCookie;
exports.cookieOptions = cookieOptions;
exports.requireBody = requireBody;
exports.metodoPermitido = metodoPermitido;
exports.hoyISO = hoyISO;
class HttpError extends Error {
    status;
    detail;
    constructor(status, message, detail) {
        super(message);
        this.status = status;
        this.detail = detail;
    }
}
exports.HttpError = HttpError;
/**
 * Responde JSON en los dos runtimes.
 * Si se asume solo el shim local, en Vercel `res.status` no existe, la excepción
 * salta DENTRO del catch de run() y la función muere con
 * FUNCTION_INVOCATION_FAILED (texto plano, 500).
 */
function json(res, status, body) {
    const r = res;
    if (typeof r.status === 'function' && typeof r.json === 'function') {
        r.status(status).json(body);
        return;
    }
    if (typeof r.setHeader === 'function')
        r.setHeader('Content-Type', 'application/json; charset=utf-8');
    r.statusCode = status;
    if (typeof r.end === 'function')
        r.end(JSON.stringify(body));
}
/** CORS explícito: la app y la API viven en el mismo dominio, pero en local usamos proxy. */
function setCors(req, res) {
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
function parseCookies(header) {
    const out = {};
    (header || '').split(';').forEach(part => {
        const i = part.indexOf('=');
        if (i < 0)
            return;
        const k = part.slice(0, i).trim();
        const v = part.slice(i + 1).trim();
        if (k)
            out[k] = decodeURIComponent(v);
    });
    return out;
}
function serializeCookie(name, value, opts = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    parts.push(`Path=${opts.path ?? '/'}`);
    if (opts.maxAge !== undefined)
        parts.push(`Max-Age=${opts.maxAge}`);
    if (opts.httpOnly !== false)
        parts.push('HttpOnly');
    if (opts.secure !== false)
        parts.push('Secure');
    parts.push(`SameSite=${(opts.sameSite ?? 'lax').replace(/^./, c => c.toUpperCase())}`);
    return parts.join('; ');
}
/** Cookies Secure no viajan por http:// → en local se omiten, si no el login nunca "pega". */
function cookieOptions(maxAgeSeconds) {
    const isLocal = (process.env.APP_URL || '').startsWith('http://');
    return { maxAge: maxAgeSeconds, httpOnly: true, secure: !isLocal, sameSite: 'lax', path: '/' };
}
function requireBody(req) {
    if (!req.body)
        return {};
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        }
        catch {
            throw new HttpError(400, 'JSON inválido');
        }
    }
    return req.body;
}
function metodoPermitido(req, res, permitidos) {
    if (req.method === 'OPTIONS') {
        const r = res;
        if (typeof r.status === 'function') {
            r.status(204).end();
        }
        else {
            r.statusCode = 204;
            if (typeof r.end === 'function')
                r.end();
        }
        return false;
    }
    if (!permitidos.includes(String(req.method))) {
        json(res, 405, { ok: false, error: 'Método no permitido' });
        return false;
    }
    return true;
}
function hoyISO(tz = process.env.APP_TIMEZONE || 'America/Mexico_City') {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}
