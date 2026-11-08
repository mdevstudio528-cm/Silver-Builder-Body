/**
 * GET /api/health — JavaScript puro (sin TypeScript, sin imports, CommonJS).
 *
 * Se deja así a propósito: si el runtime tumba también este archivo, el
 * problema es de configuración de Vercel y no del código ni de _lib.
 * No expone secretos: booleanos, longitudes y extremos del JSON pegado.
 */
'use strict';

const VERSION = 'health-js-v1-cjs-puro';

function revisarCuenta() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return { presente: false };
  const texto = String(raw).trim();
  try {
    const sa = JSON.parse(texto.charAt(0) === '{' ? texto : Buffer.from(texto, 'base64').toString('utf8'));
    const pk = String(sa.private_key || '');
    return {
      presente: true,
      json: 'ok',
      client_email: String(sa.client_email || ''),
      project_id: String(sa.project_id || ''),
      private_key_chars: pk.length,
      private_key_ok: pk.indexOf('BEGIN PRIVATE KEY') >= 0,
      private_key_saltos_reales: pk.indexOf(String.fromCharCode(10)) >= 0
    };
  } catch (e) {
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

module.exports = function handler(req, res) {
  let cuerpo;
  try {
    const driver = String(process.env.SHEETS_DRIVER || 'file').toLowerCase();
    const secret = String(process.env.SESSION_SECRET || '');
    cuerpo = {
      ok: true,
      ping: 'pong',
      version: VERSION,
      metodo: req && req.method,
      driver: driver === 'sheets' ? 'sheets' : 'file',
      runtime: { node: process.version, region: process.env.VERCEL_REGION || '', env: process.env.VERCEL_ENV || '' },
      config: {
        sessionSecret: secret.length >= 16,
        sessionSecretChars: secret.length,
        sheetIdChars: String(process.env.SHEET_ID || '').length,
        allowedOrigin: String(process.env.ALLOWED_ORIGIN || '(sin definir)')
      },
      cuentaServicio: driver === 'sheets' ? revisarCuenta() : null
    };
  } catch (e) {
    cuerpo = { ok: false, version: VERSION, error: String((e && e.message) || e) };
  }

  const texto = JSON.stringify(cuerpo);
  try {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      res.status(200).json(cuerpo);
      return;
    }
  } catch (e) { /* sigue al modo nativo */ }
  res.statusCode = 200;
  if (typeof res.setHeader === 'function') res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(texto);
};
