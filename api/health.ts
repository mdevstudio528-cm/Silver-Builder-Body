import { run } from './_lib/run';
import { json, hoyISO } from './_lib/http';
import { driverActual } from './_lib/store';

/** Revisa la cuenta de servicio SIN exponer la llave: solo longitudes y extremos. */
function revisarCuenta() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return { presente: false };
  const texto = String(raw).trim();
  try {
    const sa: any = JSON.parse(texto.startsWith('{') ? texto : Buffer.from(texto, 'base64').toString('utf8'));
    const pk = String(sa.private_key || '');
    return {
      presente: true,
      json: 'ok',
      client_email: String(sa.client_email || ''),
      project_id: String(sa.project_id || ''),
      private_key_chars: pk.length,
      private_key_ok: pk.includes('BEGIN PRIVATE KEY')
    };
  } catch (e: any) {
    return {
      presente: true,
      json: 'invalido',
      caracteres: texto.length,
      inicio: texto.slice(0, 30),
      fin: texto.slice(-30),
      error: String(e?.message || e).slice(0, 140)
    };
  }
}

export default run(async (_req, res) => {
  const driver = driverActual();
  json(res, 200, {
    ok: true,
    driver,
    hoy: hoyISO(),
    runtime: { node: process.version, region: process.env.VERCEL_REGION || '' },
    config: {
      sessionSecret: !!process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16,
      sessionSecretChars: String(process.env.SESSION_SECRET || '').length,
      sheetId: !!process.env.SHEET_ID,
      sheetIdChars: String(process.env.SHEET_ID || '').length
    },
    cuentaServicio: driver === 'sheets' ? revisarCuenta() : null,
    nota: driver === 'file'
      ? 'Modo desarrollo: los usuarios viven en data/users.json. Para producción pon SHEETS_DRIVER=sheets.'
      : 'Modo producción: los usuarios se leen/escriben en Google Sheets privado.'
  });
});
