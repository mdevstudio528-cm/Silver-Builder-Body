#!/usr/bin/env node
/* ============================================================
   preparar-env.mjs — conecta el proyecto con tu hoja de Google HOLA MUNDO
   No necesita nada instalado: solo Node 18 o superior.

   Uso:
     node preparar-env.mjs                      (lee clave.json y pide el id)
     node preparar-env.mjs clave.json 1TEvvfuL_i7In44u4hzlEX72v3Sn7lOJCC09-jIDUTSI

   Qué hace:
     1. valida el JSON de la cuenta de servicio
     2. escribe .env  (SESSION_SECRET, SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON, SHEETS_DRIVER=sheets)
     3. pide un token real a Google (prueba la firma de la clave)
     4. abre la hoja (aquí se ve el 403 de "no la compartiste")
     5. crea las pestañas usuarios / movimientos / metas / pagos con sus encabezados
     6. escribe una fila, la lee de vuelta y la borra
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createSign, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const [, , argJson, argSheet] = process.argv;
/* endpoints: se pueden sobreescribir solo para pruebas */
const API = process.env.SHEETS_API_BASE || 'https://sheets.googleapis.com/v4/spreadsheets/';
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';

const RUTA = resolve((argJson || 'clave.json').replace(/^["']|["']$/g, ''));

const OK = (t) => console.log('  ✔ ' + t);
const NO = (t, p) => { console.log('  ✘ ' + t); if (p) console.log('     → ' + p); };
const paso = (n, t) => console.log('\n' + n + ') ' + t);

const HOJAS = {
  usuarios: ['id','nombre','ap_paterno','ap_materno','telefono','correo','hash','estatus','rol','fecha_alta','ultimo_acceso','debe_cambiar_pass','session_version','intentos_fallidos','bloqueado_hasta'],
  movimientos: ['id','user_id','fecha','tipo','categoria','descripcion','monto','metodo','created_at','updated_at','deleted'],
  metas: ['id','user_id','nombre','monto_objetivo','monto_actual','fecha_limite','prioridad','aporte_mensual','created_at','updated_at','deleted'],
  pagos: ['id','user_id','fecha_pago','monto','metodo','meses','periodo_desde','periodo_hasta','notas','created_at','updated_at','deleted']
};

function setVar(texto, clave, valor) {
  const lineas = texto.split(/\r?\n/);
  const re = new RegExp('^\\s*' + clave + '\\s*=');
  const i = lineas.findIndex((l) => re.test(l));
  if (i >= 0) lineas[i] = clave + '=' + valor; else lineas.push(clave + '=' + valor);
  return lineas.filter((l, k, a) => !(l.trim() === '' && a[k - 1] !== undefined && a[k - 1].trim() === '')).join('\n').trim() + '\n';
}
function getVar(texto, clave) {
  const m = texto.match(new RegExp('^\\s*' + clave + '\\s*=(.*)$', 'm'));
  return m ? m[1].trim() : '';
}

async function main() {
  console.log('\n===== Conectar con Google Sheets =====');

  /* ---------- 1) JSON ---------- */
  paso(1, 'Leer la clave');
  if (!existsSync(RUTA)) {
    NO('No encuentro el archivo: ' + RUTA + '');
    console.log('     → Pon el .json en la carpeta del proyecto o pasa la ruta:\n       node preparar-env.mjs "D:\\ruta\\clave.json"');
    process.exit(1);
  }
  let sa;
  try { sa = JSON.parse(readFileSync(RUTA, 'utf8')); }
  catch (e) { NO('El archivo no es un JSON válido', e.message); process.exit(1); }
  if (sa.type !== 'service_account') { NO('No es una cuenta de servicio (type=' + sa.type + ')', 'Necesitas la clave JSON de una CUENTA DE SERVICIO.'); process.exit(1); }
  if (!sa.client_email || !sa.private_key) { NO('Le falta client_email o private_key', 'Descarga la clave otra vez desde Google Cloud.'); process.exit(1); }
  OK('cuenta: ' + sa.client_email);

  /* ---------- 2) .env ---------- */
  paso(2, 'Escribir .env');
  let env = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
  if (!getVar(env, 'SESSION_SECRET')) { env = setVar(env, 'SESSION_SECRET', randomBytes(48).toString('base64')); OK('SESSION_SECRET generado'); }
  else OK('SESSION_SECRET ya existía, se conserva');

  let sheetId = (argSheet || getVar(env, 'SHEET_ID') || '').trim()
    .replace(/^.*\/d\//, '').replace(/[\/#?].*$/, '');
  if (!sheetId) { NO('Falta el id de la hoja', 'node preparar-env.mjs clave.json 1TEvvfuL_...'); process.exit(1); }
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(sheetId)) { NO('El id de la hoja no parece válido: ' + sheetId, 'Es solo el texto entre /d/ y /edit.'); process.exit(1); }
  if (sheetId === '1DGtaaphu0T8IEg-B1hjD5Ln1muAyWTFzV-5807IBf_I') { NO('Ese es el id de Urban Rocket', 'Este proyecto debe usar una hoja NUEVA.'); process.exit(1); }

  env = setVar(env, 'SHEET_ID', sheetId);
  env = setVar(env, 'GOOGLE_SERVICE_ACCOUNT_JSON', JSON.stringify(sa));
  env = setVar(env, 'SHEETS_DRIVER', 'sheets');
  if (!getVar(env, 'APP_TIMEZONE')) env = setVar(env, 'APP_TIMEZONE', 'America/Mexico_City');
  if (!getVar(env, 'ALLOWED_ORIGIN')) env = setVar(env, 'ALLOWED_ORIGIN', 'http://localhost:4200');
  writeFileSync('.env', env, 'utf8');
  OK('.env escrito (SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON en 1 línea, SHEETS_DRIVER=sheets)');

  /* ---------- 3) token ---------- */
  paso(3, 'Pedir token a Google (prueba la firma)');
  const iat = Math.floor(Date.now() / 1000);
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const sinFirma = enc({ alg: 'RS256', typ: 'JWT', kid: sa.private_key_id }) + '.' + enc({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600
  });
  let jwt;
  try { jwt = sinFirma + '.' + createSign('RSA-SHA256').update(sinFirma).sign(sa.private_key, 'base64url'); }
  catch { NO('No se pudo firmar con private_key', 'La clave está corrupta. Descarga otra clave JSON desde Google Cloud.'); process.exit(1); }
  OK('firma JWT generada');

  let token = '';
  try {
    const r = await fetch(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
    });
    const j = await r.json();
    if (!j.access_token) {
      NO('Google rechazó la clave (' + (j.error || r.status) + ')', j.error_description || 'La clave puede estar borrada en Google Cloud. Genera una nueva.');
      process.exit(1);
    }
    token = j.access_token;
  } catch (e) { NO('Sin conexión a Google', e.message); process.exit(1); }
  OK('token obtenido');

  const base = API + sheetId;
  const H = { Authorization: 'Bearer ' + token };
  const pedir = async (url, opts = {}) => {
    const r = await fetch(url, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
    const txt = await r.text();
    if (!r.ok) {
      if (r.status === 403) { NO('La cuenta de servicio NO tiene permiso sobre la hoja (403)', 'Abre la hoja → Compartir → ' + sa.client_email + ' como EDITOR.'); }
      else if (r.status === 404) { NO('No existe esa hoja (404)', 'Revisa el id: debe ser el de la URL, entre /d/ y /edit.'); }
      else { NO('Google respondió ' + r.status, txt.slice(0, 300)); }
      process.exit(1);
    }
    return txt ? JSON.parse(txt) : {};
  };

  /* ---------- 4) abrir hoja ---------- */
  paso(4, 'Abrir la hoja');
  const meta = await pedir(base + '?fields=properties.title,sheets.properties.title');
  OK('hoja: "' + (meta.properties?.title || '?') + '"');
  const tabs = (meta.sheets || []).map((s) => s.properties.title);
  console.log('     pestañas actuales: ' + (tabs.join(', ') || '(ninguna)'));

  /* ---------- 5) pestañas ---------- */
  paso(5, 'Crear pestañas y encabezados');
  const letra = (n) => { let s = ''; let x = n; while (x > 0) { const m = (x - 1) % 26; s = String.fromCharCode(65 + m) + s; x = Math.floor((x - 1) / 26); } return s; };
  for (const [hoja, cols] of Object.entries(HOJAS)) {
    if (!tabs.includes(hoja)) {
      await pedir(base + ':batchUpdate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: hoja } } }] })
      });
    }
    const rango = hoja + '!A1:' + letra(cols.length) + '1';
    const cur = await pedir(base + '/values/' + encodeURIComponent(rango));
    if (!cur.values || !cur.values[0] || !cur.values[0][0]) {
      await pedir(base + '/values/' + encodeURIComponent(hoja + '!A1') + '?valueInputOption=RAW', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [cols] })
      });
    }
    OK(hoja + ' (' + cols.length + ' columnas)');
  }

  /* ---------- 6) prueba de escritura ---------- */
  paso(6, 'Escribir, leer y borrar una fila de prueba');
  const T = '_verificacion';
  if (!tabs.includes(T)) {
    await pedir(base + ':batchUpdate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: [{ addSheet: { properties: { title: T } } }] }) });
  }
  // La pestaña de prueba necesita su fila de encabezados: si está vacía, un append
  // escribe en la FILA 1 y luego leer desde A2 devuelve nada (el bug de la v1).
  const HDR = ['prueba', 'cuando', 'quien'];
  const cab = await pedir(base + '/values/' + encodeURIComponent(T + '!A1:C1'));
  if (!cab.values || !cab.values[0] || !cab.values[0][0]) {
    await pedir(base + '/values/' + encodeURIComponent(T + '!A1') + '?valueInputOption=RAW', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [HDR] })
    });
  }

  const marca = 'chk_' + Date.now().toString(36);
  await pedir(base + '/values/' + encodeURIComponent(T + '!A1') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [[marca, new Date().toISOString(), 'preparar-env']] })
  });

  // se lee desde A1 y se busca la marca en cualquier fila (robusto)
  const leidas = await pedir(base + '/values/' + encodeURIComponent(T + '!A1:C500'));
  const filas = leidas.values || [];
  const vista = filas.some((f) => String(f[0]) === marca);

  // se limpia todo el rango de prueba
  await pedir(base + '/values/' + encodeURIComponent(T + '!A1:C500') + ':clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });

  if (!vista) {
    NO('Se escribió pero no se leyó de vuelta');
    console.log('     filas leídas: ' + filas.length + (filas.length ? ' | primera: ' + JSON.stringify(filas[0]) : ''));
    console.log('     → Revisa celdas protegidas o filtros en la hoja "' + T + '".');
    process.exit(1);
  }
  OK('marca ' + marca + ' encontrada al leer (' + filas.length + ' fila(s) en el rango). Pestaña limpiada.');

  console.log('\n===== LISTO: la hoja responde =====\n');
  console.log('Ahora crea tu cuenta de administrador y arranca:\n');
  console.log('  npm run seed:admin -- --correo TU_CORREO --password "TuClave2026" --nombre Carlos --paterno Meyer');
  console.log('  npm run dev:api        (debe decir: driver → sheets)');
  console.log('  npm start\n');
  console.log('IMPORTANTE: borra clave.json de la carpeta del proyecto cuando termines.\n');
}

main().catch((e) => { console.error('\n✘ Error inesperado:', e?.message || e); process.exit(1); });
