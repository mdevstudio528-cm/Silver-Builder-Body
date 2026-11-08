/**
 * Servidor local que ejecuta las mismas funciones de /api sin Vercel.
 * Uso:  npm run dev:api      (escucha en http://localhost:3001)
 * El dev server de Angular proxya /api/* hacia aquí (proxy.conf.json).
 */
import './_env'; // misma carga de .env que los demás scripts: la ÚLTIMA clave repetida gana
import { createServer } from 'node:http';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();

const RUTAS: Record<string, string> = {
  '/api/health': 'api/health.ts',
  '/api/auth/login': 'api/auth/login.ts',
  '/api/auth/logout': 'api/auth/logout.ts',
  '/api/auth/me': 'api/auth/me.ts',
  '/api/auth/change-password': 'api/auth/change-password.ts',
  '/api/admin/users': 'api/admin/users.ts',
  '/api/admin/user-update': 'api/admin/user-update.ts',
  '/api/sync': 'api/sync.ts',
  '/api/goals': 'api/goals.ts',
  '/api/admin/sheet-check': 'api/admin/sheet-check.ts',
  '/api/admin/cobranza': 'api/admin/cobranza.ts',
  '/api/admin/pagos': 'api/admin/pagos.ts'
};

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  (header || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i < 0) return;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const path = url.pathname.replace(/\/$/, '');

  const modulo = RUTAS[path];
  if (!modulo) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: `Ruta no encontrada: ${path}`, disponibles: Object.keys(RUTAS) }));
    return;
  }

  // cuerpo
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  let body: any = {};
  if (raw) { try { body = JSON.parse(raw); } catch { body = raw; } }

  // respuesta tipo express (lo que esperan los handlers)
  let statusCode = 200;
  const headers: Record<string, string[]> = {};
  const shim: any = {
    status(code: number) { statusCode = code; return shim; },
    setHeader(k: string, v: any) { headers[k] = Array.isArray(v) ? v : [String(v)]; },
    json(obj: any) {
      res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, v])) });
      res.end(JSON.stringify(obj));
    },
    end(chunk?: any) { res.writeHead(statusCode, headers); res.end(chunk); }
  };

  const fakeReq = {
    method: req.method,
    headers: req.headers,
    body,
    query: Object.fromEntries(url.searchParams.entries()),
    cookies: parseCookies(String(req.headers.cookie || ''))
  };

  try {
    const mod = await import(pathToFileURL(join(ROOT, modulo)).href);
    await mod.default(fakeReq, shim);
  } catch (e: any) {
    console.error(`[${req.method} ${path}]`, e);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e?.message || 'Error interno', stack: String(e?.stack || '') }));
    }
  }
});

const PORT = Number(process.env.PORT || 3001);
server.listen(PORT, () => {
  console.log(`\n  API local → http://localhost:${PORT}`);
  console.log(`  driver   → ${process.env.SHEETS_DRIVER || 'file'}`);
  console.log(`  rutas    → ${Object.keys(RUTAS).length}\n`);
});
