/**
 * Cliente de Google Sheets con cuenta de servicio. Sin dependencias.
 *
 * Reglas de esta capa:
 *   - un solo token OAuth cacheado por instancia (evita pedir token por fila)
 *   - errores de Google traducidos a algo accionable (403 = falta compartir la hoja)
 *   - escrituras por LOTE: 1 append con N filas y 1 batchUpdate con N cambios,
 *     porque la cuota de Sheets es 60 peticiones/minuto por usuario
 */
import { createSign } from 'crypto';
import { readFileSync } from 'fs';

const SHEET_ID = () => {
  const id = process.env.SHEET_ID;
  if (!id) throw new SheetsError(500, 'Falta SHEET_ID en las variables de entorno', 'Configura SHEET_ID con el id de la hoja nueva (no la de Urban Rocket).');
  return id;
};

export class SheetsError extends Error {
  status: number;
  pista: string;
  constructor(status: number, mensaje: string, pista = '') {
    super(mensaje);
    this.status = status;
    this.pista = pista;
  }
}

/** Traduce la respuesta de Google a un mensaje que se pueda accionar. */
function mapearError(status: number, cuerpo: string, contexto: string): SheetsError {
  const txt = String(cuerpo || '').slice(0, 600);
  if (status === 401 || /invalid_grant|Invalid JWT|invalid_client/i.test(txt)) {
    return new SheetsError(401,
      `Google rechazó las credenciales (${contexto}).`,
      'Revisa que GOOGLE_SERVICE_ACCOUNT_JSON esté completo (private_key con \\n) y que la clave no haya sido borrada en Google Cloud.');
  }
  if (status === 403) {
    return new SheetsError(403,
      `La cuenta de servicio no tiene permiso sobre la hoja (${contexto}).`,
      'Abre la hoja → Compartir → agrega el correo de la cuenta de servicio (termina en @...iam.gserviceaccount.com) como EDITOR. Este es el error 403 más común.');
  }
  if (status === 404) {
    return new SheetsError(404,
      `No se encontró la hoja (${contexto}).`,
      'Verifica SHEET_ID: es el texto entre /d/ y /edit en la URL de la hoja. Revisa también que no estés usando el id de otra hoja.');
  }
  if (status === 429) {
    return new SheetsError(429,
      `Google limitó las peticiones (${contexto}).`,
      'La cuota es 60 peticiones/minuto. La app ya agrupa escrituras por lote; si persiste, baja el tamaño del lote.');
  }
  return new SheetsError(status, `Sheets ${contexto} falló (${status}): ${txt}`, '');
}

let tokenCache: { token: string; exp: number } = { token: '', exp: 0 };

function leerCuenta() {
  // 1) ruta a un archivo (cómodo en local), 2) JSON/base64 en la variable de entorno
  const rutaArchivo = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw && rutaArchivo) {
    try {
      raw = readFileSync(rutaArchivo, 'utf8');
    } catch {
      throw new SheetsError(500, `No se pudo leer GOOGLE_SERVICE_ACCOUNT_FILE (${rutaArchivo})`,
        'Revisa la ruta: debe ser relativa a la raíz del proyecto, por ejemplo ./google-service-account.json');
    }
  }
  if (!raw) {
    throw new SheetsError(500, 'Falta GOOGLE_SERVICE_ACCOUNT_JSON',
      'Pega el JSON completo de la clave de la cuenta de servicio, o su versión en base64.');
  }
  let sa: any;
  try {
    sa = JSON.parse(String(raw).trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    throw new SheetsError(500, 'GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido',
      'El valor debe empezar con { "type": "service_account", ... }. En Vercel, pégalo tal cual (sin comillas extra).');
  }
  if (!sa.client_email || !sa.private_key) {
    throw new SheetsError(500, 'La cuenta de servicio no tiene client_email o private_key',
      'Descarga de nuevo la clave JSON desde Google Cloud → IAM → Cuentas de servicio → Claves.');
  }
  return sa;
}

async function accessToken(): Promise<string> {
  if (tokenCache.token && Date.now() < tokenCache.exp - 60_000) return tokenCache.token;

  const sa = leerCuenta();
  const iat = Math.floor(Date.now() / 1000);
  const enc = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT', kid: sa.private_key_id })}.${enc({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600
  })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  let jwt: string;
  try {
    jwt = `${unsigned}.${signer.sign(sa.private_key, 'base64url')}`;
  } catch {
    throw new SheetsError(500, 'La private_key de la cuenta de servicio no se pudo firmar',
      'Suele pasar cuando se pega el JSON con los \\n escapados mal. Reemplaza los \\n por saltos de línea reales o vuelve a pegar el JSON.');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  const j: any = await res.json().catch(() => ({}));
  if (!j.access_token) throw mapearError(res.status, JSON.stringify(j), 'token');
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}

const base = () => `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID()}`;

/** Letra de columna para n=1 → A, 26 → Z, 27 → AA. */
export function colLetra(n: number): string {
  let s = '';
  let x = Math.max(1, n);
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** Título de la hoja y pestañas existentes. */
export async function sheetsMeta(): Promise<{ hoja: string; tabs: string[] }> {
  const token = await accessToken();
  const res = await fetch(`${base()}?fields=properties.title,sheets.properties.title`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw mapearError(res.status, await res.text(), 'metadata');
  const j: any = await res.json();
  return {
    hoja: j?.properties?.title || '(sin título)',
    tabs: (j.sheets || []).map((s: any) => s.properties?.title).filter(Boolean)
  };
}

export async function sheetsGetValues(range: string): Promise<any[][]> {
  const token = await accessToken();
  const res = await fetch(`${base()}/values/${encodeURIComponent(range)}?majorDimension=ROWS`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 404) return [];
  if (!res.ok) throw mapearError(res.status, await res.text(), `GET ${range}`);
  return ((await res.json()) as any).values || [];
}

/** Sube VARIAS filas nuevas en una sola petición. */
export async function sheetsAppendRows(sheet: string, rows: (string | number)[][]): Promise<void> {
  if (!rows.length) return;
  const token = await accessToken();
  const res = await fetch(
    `${base()}/values/${encodeURIComponent(sheet + '!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows })
    }
  );
  if (!res.ok) throw mapearError(res.status, await res.text(), `APPEND ${sheet}`);
}

export async function sheetsAppendRow(sheet: string, row: (string | number)[]): Promise<void> {
  await sheetsAppendRows(sheet, [row]);
}

/** Actualiza VARIOS rangos en una sola petición. */
export async function sheetsBatchUpdate(data: { range: string; values: (string | number)[][] }[]): Promise<void> {
  if (!data.length) return;
  const token = await accessToken();
  const res = await fetch(`${base()}/values:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'RAW', data })
  });
  if (!res.ok) throw mapearError(res.status, await res.text(), 'BATCH UPDATE');
}

export async function sheetsUpdateRow(range: string, row: (string | number)[]): Promise<void> {
  const token = await accessToken();
  const res = await fetch(`${base()}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] })
  });
  if (!res.ok) throw mapearError(res.status, await res.text(), `PUT ${range}`);
}

/** Borra el contenido de un rango (deja las celdas vacías, no borra filas). */
export async function sheetsClearRange(range: string): Promise<void> {
  const token = await accessToken();
  const res = await fetch(`${base()}/values/${encodeURIComponent(range)}:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!res.ok) throw mapearError(res.status, await res.text(), `CLEAR ${range}`);
}

/**
 * Crea la pestaña si no existe y escribe los encabezados solo si están vacíos.
 * El rango de encabezados se calcula con el número real de columnas.
 */
export async function sheetsEnsureSheet(sheet: string, headers: string[]): Promise<void> {
  // Sin esta guarda, un import mal escrito revienta con
  // "Cannot read properties of undefined (reading 'length')" y no dice dónde.
  if (!Array.isArray(headers) || headers.length === 0) {
    const e: any = new Error(`sheetsEnsureSheet("${sheet}") recibió encabezados inválidos`);
    e.pista = 'Revisa que la lista de columnas se importe con el nombre correcto (store.ts → COLUMNAS).';
    throw e;
  }

  const token = await accessToken();
  const meta = await fetch(`${base()}?fields=sheets.properties.title`, { headers: { Authorization: `Bearer ${token}` } });
  if (!meta.ok) throw mapearError(meta.status, await meta.text(), 'metadata');
  const j: any = await meta.json();
  const titles: string[] = (j.sheets || []).map((s: any) => s.properties?.title);

  if (!titles.includes(sheet)) {
    const r = await fetch(`${base()}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheet } } }] })
    });
    if (!r.ok) throw mapearError(r.status, await r.text(), `crear pestaña ${sheet}`);
  }

  const ancho = colLetra(headers.length);
  const head = await sheetsGetValues(`${sheet}!A1:${ancho}1`);
  if (!head.length || !head[0][0]) await sheetsUpdateRow(`${sheet}!A1`, headers);
}

/** Diagnóstico completo sin escribir nada. */
export async function verificarCredenciales(): Promise<{
  ok: boolean; cuenta?: string; hoja?: string; tabs?: string[]; sheetId?: string; error?: string; pista?: string;
}> {
  try {
    const sa = leerCuenta();
    const id = SHEET_ID();
    tokenCache = { token: '', exp: 0 };           // token fresco: así se prueba de verdad la firma
    await accessToken();
    const m = await sheetsMeta();
    return { ok: true, cuenta: sa.client_email, hoja: m.hoja, tabs: m.tabs, sheetId: id };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error desconocido', pista: e?.pista || '' };
  }
}
