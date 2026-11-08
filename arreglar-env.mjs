#!/usr/bin/env node
/**
 * arreglar-env.mjs — Diagnostica y repara el .env del Administrador Financiero UR.
 * Node 18+, sin dependencias.
 *
 * Uso:
 *   node arreglar-env.mjs           revisa, repara y reescribe .env limpio
 *   node arreglar-env.mjs --test    además pide un token real a Google y abre la hoja
 *
 * Qué arregla:
 *   - claves duplicadas (una SHEETS_DRIVER=file vieja pisando la nueva)
 *   - SHEET_ID pegado como URL completa
 *   - SESSION_SECRET ausente o corto
 *   - GOOGLE_SERVICE_ACCOUNT_JSON partido en varias líneas / no válido
 *   - BOM y saltos de línea CRLF de Windows
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { createSign, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const RUTA = resolve(process.cwd(), '.env');
const BAK = resolve(process.cwd(), '.env.bak');
const TEST = process.argv.includes('--test');

const titulo = (s) => console.log('\n' + s);
const ok = (s) => console.log('  ✔ ' + s);
const mal = (s) => console.log('  ✘ ' + s);
const avi = (s) => console.log('  ! ' + s);

function limpiar(v) {
  let s = String(v).trim();
  if (s.length > 1 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
    s = s.slice(1, -1);
  }
  return s;
}
function esJSON(s) {
  try { JSON.parse(s); return true; } catch { return false; }
}

titulo('===== Revisar .env =====');
if (!existsSync(RUTA)) {
  mal('No existe .env en ' + process.cwd());
  console.log('     Corre este script en la carpeta del proyecto (donde está package.json).');
  process.exit(1);
}

let crudo = readFileSync(RUTA, 'utf8');
if (crudo.charCodeAt(0) === 0xfeff) { crudo = crudo.slice(1); avi('se quitó el BOM del inicio del archivo'); }
if (crudo.includes('\r')) avi('se normalizaron los saltos CRLF de Windows');
const lineas = crudo.split(/\r?\n/);

/* ---------- 1. leer y detectar duplicados ---------- */
const entradas = [];
for (let i = 0; i < lineas.length; i++) {
  const l = lineas[i];
  if (!l.trim() || /^\s*#/.test(l)) continue;
  const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]*)$/);
  if (!m) { avi(`línea ${i + 1} no tiene forma CLAVE=valor, se descarta: ${l.slice(0, 40)}…`); continue; }

  const clave = m[1];
  let valor = limpiar(m[2]);

  // JSON de la cuenta de servicio: recuperar valores rotos
  // (partido en varias líneas, o con las comillas escapadas por doble entrecomillado)
  if (clave === 'GOOGLE_SERVICE_ACCOUNT_JSON' && !esJSON(valor)) {
    const desde = i;
    const prof = (s) => {
      let d = 0;
      for (const c of s) { if (c === '{') d++; else if (c === '}') d--; }
      return d;
    };
    let j = i;
    let buf = valor;
    while (prof(buf) > 0 && j + 1 < lineas.length && j - desde < 200) { j++; buf += '\n' + lineas[j]; }

    const candidatos = [
      () => buf.trim(),
      () => buf.replace(/\\"/g, '"').trim(),
      () => buf.replace(/[\r\n]+/g, '\\n').trim(),
      () => buf.replace(/\\"/g, '"').replace(/[\r\n]+/g, '\\n').trim(),
      () => buf.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
    ];
    let reparado = '';
    for (const f of candidatos) {
      const t = f();
      if (esJSON(t)) { reparado = t; break; }
    }
    if (reparado) {
      valor = reparado;
      if (j > desde) {
        avi(`GOOGLE_SERVICE_ACCOUNT_JSON ocupaba ${j - desde + 1} líneas: se reconstruyó en 1 línea válida`);
      } else {
        avi('GOOGLE_SERVICE_ACCOUNT_JSON tenía comillas escapadas o saltos reales: se normalizó');
      }
      i = j;
    } else {
      avi('GOOGLE_SERVICE_ACCOUNT_JSON roto: no se pudo reconstruir (se marcará como error abajo)');
    }
  }
  entradas.push({ clave, valor, linea: i + 1 });
}

const porClave = new Map();
for (const e of entradas) {
  if (!porClave.has(e.clave)) porClave.set(e.clave, []);
  porClave.get(e.clave).push(e);
}

titulo('1) Claves encontradas en el archivo');
for (const [clave, lista] of porClave) {
  const lineasTxt = lista.map((x) => x.linea).join(', ');
  if (lista.length > 1) {
    mal(`${clave}: aparece ${lista.length} veces (líneas ${lineasTxt}) → ESTA es la causa de valores viejos ganando`);
  } else {
    ok(`${clave} (línea ${lineasTxt})`);
  }
}

const elegir = (clave) => {
  const lista = porClave.get(clave) || [];
  if (!lista.length) return '';
  // para el JSON se prefiere la última versión que sí parsea
  if (clave === 'GOOGLE_SERVICE_ACCOUNT_JSON') {
    for (let k = lista.length - 1; k >= 0; k--) if (esJSON(lista[k].valor)) return lista[k].valor;
  }
  return lista[lista.length - 1].valor;
};

/* ---------- 2. validar y normalizar cada valor ---------- */
titulo('2) Revisar cada valor');
const final = {};
let errores = 0;

// SHEET_ID (acepta URL completa)
let sheetId = limpiar(elegir('SHEET_ID'));
const mUrl = sheetId.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
if (mUrl) { sheetId = mUrl[1]; avi('SHEET_ID venía como URL, se guardó solo el id'); }
if (!/^[A-Za-z0-9_-]{20,}$/.test(sheetId)) {
  mal('SHEET_ID inválido o vacío: ' + (sheetId || '(nada)'));
  errores++;
} else {
  ok('SHEET_ID → ' + sheetId);
}
final.SHEET_ID = sheetId;

// SESSION_SECRET
let secret = limpiar(elegir('SESSION_SECRET'));
if (secret.length < 16) {
  secret = randomBytes(48).toString('base64');
  avi('SESSION_SECRET faltaba o era muy corto → generado uno nuevo (las sesiones abiertas se cierran)');
} else {
  ok('SESSION_SECRET → ' + secret.length + ' caracteres');
}
final.SESSION_SECRET = secret;

// SHEETS_DRIVER
let driver = limpiar(elegir('SHEETS_DRIVER')).toLowerCase();
if (driver !== 'sheets') {
  avi(`SHEETS_DRIVER era "${driver || '(vacío)'}" → se pone "sheets" para que la API use la hoja`);
  driver = 'sheets';
} else {
  ok('SHEETS_DRIVER → sheets');
}
final.SHEETS_DRIVER = driver;

// JSON de la cuenta de servicio
const jsonTxt = elegir('GOOGLE_SERVICE_ACCOUNT_JSON');
let sa = null;
if (!jsonTxt) {
  mal('Falta GOOGLE_SERVICE_ACCOUNT_JSON');
  errores++;
} else if (!esJSON(jsonTxt)) {
  mal('GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido (' + jsonTxt.length + ' caracteres)');
  console.log('     → este es exactamente el error que muestra tu pantalla de login.');
  errores++;
} else {
  sa = JSON.parse(jsonTxt);
  if (sa.type !== 'service_account') {
    mal('La clave no es de tipo service_account (tipo: "' + sa.type + '")');
    errores++;
  } else if (!sa.client_email || !sa.private_key) {
    mal('A la clave le falta client_email o private_key');
    errores++;
  } else {
    const cuerpoPem = String(sa.private_key).replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
    ok('cuenta → ' + sa.client_email);
    ok('private_key → ' + String(sa.private_key).length + ' caracteres, ' + cuerpoPem.length + ' útiles');
    if (cuerpoPem.length < 500) { mal('la private_key parece incompleta (muy corta)'); errores++; }
    final.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(sa);
  }
}

// resto
final.APP_TIMEZONE = limpiar(elegir('APP_TIMEZONE')) || 'America/Mexico_City';
final.ALLOWED_ORIGIN = limpiar(elegir('ALLOWED_ORIGIN')) || 'http://localhost:4200';
ok('APP_TIMEZONE → ' + final.APP_TIMEZONE);
ok('ALLOWED_ORIGIN → ' + final.ALLOWED_ORIGIN);

/* ---------- 3. reescribir ---------- */
titulo('3) Reescribir .env');
if (errores) {
  mal(`hay ${errores} error(es): no se reescribió nada. Corrige lo marcado y vuelve a correr.`);
  process.exit(2);
}

copyFileSync(RUTA, BAK);
const orden = ['SESSION_SECRET', 'SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'SHEETS_DRIVER', 'APP_TIMEZONE', 'ALLOWED_ORIGIN'];
const cuerpo = [
  '# Administrador Financiero UR — archivo generado por arreglar-env.mjs',
  '# NO subir a git. En Vercel: copiar estas mismas claves en Settings → Environment Variables.',
  ...orden.map((k) => k + '=' + final[k]),
  ''
].join('\n');
writeFileSync(RUTA, cuerpo, 'utf8');
ok('.env reescrito, sin duplicados (respaldo: .env.bak)');
ok('claves: ' + orden.join(', '));
ok('GOOGLE_SERVICE_ACCOUNT_JSON en 1 línea de ' + final.GOOGLE_SERVICE_ACCOUNT_JSON.length + ' caracteres');

/* ---------- 4. prueba opcional contra Google ---------- */
if (TEST) {
  titulo('4) Probar contra Google');
  const ahora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const cabecera = b64({ alg: 'RS256', typ: 'JWT' });
  const claims = b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: ahora + 3600,
    iat: ahora
  });
  const datos = cabecera + '.' + claims;

  let jwt;
  try {
    jwt = datos + '.' + createSign('RSA-SHA256').update(datos).sign(sa.private_key, 'base64url');
    ok('firma JWT generada');
  } catch (e) {
    mal('no se pudo firmar con la private_key: ' + e.message);
    console.log('     → regenera clave.json en Google Cloud y vuelve a correr preparar-env.mjs');
    process.exit(3);
  }

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  const j = await r.json();
  if (!j.access_token) {
    mal('Google rechazó la clave: ' + (j.error_description || j.error));
    process.exit(4);
  }
  ok('token obtenido (válido ' + Math.round((j.expires_in || 3600) / 60) + ' min)');

  const rs = await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets/' + final.SHEET_ID + '?fields=properties.title,sheets.properties.title',
    { headers: { Authorization: 'Bearer ' + j.access_token } }
  );
  if (!rs.ok) {
    mal('no se pudo abrir la hoja: HTTP ' + rs.status);
    if (rs.status === 403 || rs.status === 404) {
      console.log('     → comparte la hoja con ' + sa.client_email + ' con permiso EDITOR');
      console.log('       (Lector no permite crear pestañas ni escribir)');
    }
    process.exit(5);
  }
  const sh = await rs.json();
  ok('hoja → "' + sh.properties.title + '"');
  const pestanas = (rs.ok && sh.sheets ? sh.sheets.map((s) => s.properties.title) : []);
  ok('pestañas → ' + (pestanas.join(', ') || '(ninguna)'));
  const faltan = ['usuarios', 'movimientos', 'metas'].filter((n) => !pestañas.includes(n));
  if (faltan.length) avi('faltan pestañas: ' + faltan.join(', ') + ' (las crea node preparar-env.mjs)');
}

titulo('===== .env listo =====');
console.log(`
  Siguiente, en este orden:

    npm run seed:admin -- --correo TU_CORREO --password "TuClave2026" --nombre Carlos --paterno Meyer
    npm run dev:api        (debe decir: driver → sheets)
    npm start

  Si el seed imprime driver: file, corre:  $env:SHEETS_DRIVER="sheets"
`);
