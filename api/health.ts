/**
 * GET /api/health — diagnóstico de producción.
 *
 * IMPORTANTE: este archivo NO importa nada (ni _lib, ni fs, ni crypto).
 * Si responde 200 aquí, el runtime y las variables están bien y el problema
 * está en la cadena de imports de _lib (store → sheets → crypto/fs).
 * Si aun así devuelve FUNCTION_INVOCATION_FAILED, el problema es del runtime
 * o de la configuración de Functions en Vercel, no del código.
 *
 * No expone secretos: solo booleanos, longitudes y los extremos del JSON mal pegado.
 */

const VERSION = 'health-v3-sin-imports';

function hoy(): string {
  try {
    const tz = process.env.APP_TIMEZONE || 'America/Mexico_City';
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function revisarCuenta() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return { presente: false };
  const texto = String(raw).trim();
  try {
    const sa: any = JSON.parse(texto.charAt(0) === '{' ? texto : Buffer.from(texto, 'base64').toString('utf8'));
    const pk = String(sa.private_key || '');
    return {
      presente: true,
      json: 'ok',
      client_email: String(sa.client_email || ''),
      project_id: String(sa.project_id || ''),
      private_key_chars: pk.length,
      private_key_ok: pk.indexOf('BEGIN PRIVATE KEY') >= 0,
      // los \n del PEM deben ser texto escapado, no saltos reales
      private_key_saltos_reales: pk.indexOf(String.fromCharCode(10)) >= 0
    };
  } catch (e: any) {
    return {
      presente: true,
      json: 'invalido',
      caracteres: texto.length,
      inicio: texto.slice(0, 30),
      fin: texto.slice(-30),
      error: String((e && e.message) || e).slice(0, 160)
    };
  }
}

export default function handler(_req: any, res: any) {
  let cuerpo: any;
  try {
    const driver = String(process.env.SHEETS_DRIVER || 'file').toLowerCase();
    const secret = String(process.env.SESSION_SECRET || '');
    cuerpo = {
      ok: true,
      ping: 'pong',
      version: VERSION,
      driver: driver === 'sheets' ? 'sheets' : 'file',
      hoy: hoy(),
      runtime: { node: process.version, region: process.env.VERCEL_REGION || '', env: process.env.VERCEL_ENV || '' },
      config: {
        sessionSecret: secret.length >= 16,
        sessionSecretChars: secret.length,
        sheetIdChars: String(process.env.SHEET_ID || '').length,
        allowedOrigin: String(process.env.ALLOWED_ORIGIN || '(sin definir)')
      },
      cuentaServicio: driver === 'sheets' ? revisarCuenta() : null
    };
  } catch (e: any) {
    cuerpo = { ok: false, version: VERSION, error: String((e && e.message) || e) };
  }

  const texto = JSON.stringify(cuerpo);
  try {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      res.status(200).json(cuerpo);
      return;
    }
  } catch { /* sigue al modo nativo */ }
  res.statusCode = 200;
  if (typeof res.setHeader === 'function') res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(texto);
}
