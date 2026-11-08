/**
 * Pone las credenciales de Google en el .env sin pelear con comillas,
 * saltos de línea ni llaves rotas.
 *
 * Uso (Windows / Mac / Linux, desde la raíz del proyecto):
 *
 *   npm run preparar:env -- --json "C:\Users\Tu\Downloads\sturdy-practice-514108-r7-abc123.json" --sheet 1TEvvfuL_i7In44u4hzlEX72v3Sn7lOJCC09-jIDUTSI
 *
 * Opciones:
 *   --json <ruta>     archivo .json que descargaste de Google Cloud (obligatorio)
 *   --sheet <id>      id de la hoja (lo que está entre /d/ y /edit en la URL)
 *   --b64             guarda las credenciales en base64 (si tu plataforma
 *                     maltrata las llaves del JSON, ej. algunos paneles web)
 *   --driver sheets   deja SHEETS_DRIVER=sheets (por defecto lo pone en sheets)
 *   --file            en lugar de pegar el JSON, guarda una ruta de archivo
 *                     (solo sirve en local; en Vercel no hay archivos)
 *
 * Por qué un script y no copiar/pegar: el JSON trae ~30 líneas con saltos
 * dentro de private_key. Pegado a mano en .env se rompe el 90% de las veces.
 */
import '../scripts/_env';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const arg = (n: string, def = '') => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const flag = (n: string) => args.includes(`--${n}`);

const ENV = resolve('.env');

function leerEnv(): string[] {
  if (!existsSync(ENV)) return [];
  return readFileSync(ENV, 'utf8').split(/\r?\n/);
}

/** Reemplaza la línea de una clave, o la agrega al final. */
function poner(lineas: string[], clave: string, valor: string): void {
  const i = lineas.findIndex(l => new RegExp(`^\\s*${clave}\\s*=`).test(l));
  const nueva = `${clave}=${valor}`;
  if (i >= 0) lineas[i] = nueva;
  else lineas.push(nueva);
}

function quitar(lineas: string[], clave: string): void {
  const i = lineas.findIndex(l => new RegExp(`^\\s*${clave}\\s*=`).test(l));
  if (i >= 0) lineas.splice(i, 1);
}

const ok = (t: string) => console.log(`  ✓ ${t}`);
const mal = (t: string, pista = '') => { console.log(`  ✗ ${t}`); if (pista) console.log(`    → ${pista}`); };

function main() {
  const rutaJson = arg('json');
  const sheetId = arg('sheet', process.env.SHEET_ID || '').trim();
  const usarB64 = flag('b64');
  const soloRuta = flag('file');

  console.log('\n=== Preparar credenciales en .env ===\n');

  if (!rutaJson) {
    mal('Falta --json <ruta del archivo>',
      'npm run preparar:env -- --json "C:\\Users\\Tu\\Downloads\\clave.json" --sheet TU_SHEET_ID');
    process.exit(1);
  }
  const abs = resolve(rutaJson.replace(/^["']|["']$/g, ''));
  if (!existsSync(abs)) {
    mal(`No existe el archivo: ${abs}`, 'Revisa la ruta; en Windows arrastra el archivo a la terminal para pegar la ruta completa.');
    process.exit(1);
  }

  let sa: any;
  try {
    sa = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (e: any) {
    mal('El archivo no es un JSON válido', e?.message || '');
    process.exit(1);
  }

  if (sa.type !== 'service_account') {
    mal(`El archivo no es de una cuenta de servicio (type = "${sa.type}")`,
      'Necesitas la clave JSON de una CUENTA DE SERVICIO, no de un cliente OAuth.');
    process.exit(1);
  }
  if (!sa.client_email || !sa.private_key) {
    mal('Al JSON le falta client_email o private_key', 'Vuelve a descargar la clave desde Google Cloud.');
    process.exit(1);
  }
  if (!String(sa.private_key).includes('BEGIN PRIVATE KEY')) {
    mal('private_key no parece una llave PEM', 'Debe empezar con -----BEGIN PRIVATE KEY-----.');
    process.exit(1);
  }
  ok('JSON de cuenta de servicio válido');
  ok(`cuenta: ${sa.client_email}`);
  ok(`proyecto: ${sa.project_id || '(sin project_id)'}`);

  if (!sheetId) {
    mal('Falta --sheet <id de la hoja>',
      'Es el texto entre /d/ y /edit: docs.google.com/spreadsheets/d/ <<AQUI>> /edit');
    process.exit(1);
  }
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(sheetId)) {
    mal(`El SHEET_ID no parece válido: "${sheetId}"`,
      'Copia solo el id: sin "docs.google.com", sin "/edit", sin "#gid=0".');
    process.exit(1);
  }
  if (sheetId === '1DGtaaphu0T8IEg-B1hjD5Ln1muAyWTFzV-5807IBf_I') {
    console.log('  ! Aviso: ese es el id de la hoja de Urban Rocket. Este proyecto debe usar una hoja NUEVA.');
  }
  ok(`hoja: ${sheetId}`);

  /* ---------------- escribir .env ---------------- */
  const lineas = leerEnv();

  const secretoActual = (lineas.find(l => /^\s*SESSION_SECRET=/.test(l)) || '').split('=')[1] || '';
  if (!secretoActual.trim()) {
    poner(lineas, 'SESSION_SECRET', randomBytes(48).toString('base64'));
    ok('SESSION_SECRET generado (48 bytes en base64)');
  } else {
    ok('SESSION_SECRET ya existía, se conserva');
  }

  poner(lineas, 'SHEET_ID', sheetId);

  const unaLinea = JSON.stringify(sa);
  if (soloRuta) {
    const destino = resolve('google-service-account.json');
    copyFileSync(abs, destino);
    poner(lineas, 'GOOGLE_SERVICE_ACCOUNT_FILE', './google-service-account.json');
    quitar(lineas, 'GOOGLE_SERVICE_ACCOUNT_JSON');
    ok('GOOGLE_SERVICE_ACCOUNT_FILE=./google-service-account.json (y se copió el archivo al proyecto)');
    console.log('    ! Ese archivo NO se sube a git; revisa que esté en .gitignore.');
  } else if (usarB64) {
    poner(lineas, 'GOOGLE_SERVICE_ACCOUNT_JSON', Buffer.from(unaLinea, 'utf8').toString('base64'));
    quitar(lineas, 'GOOGLE_SERVICE_ACCOUNT_FILE');
    ok(`GOOGLE_SERVICE_ACCOUNT_JSON en base64 (${Buffer.from(unaLinea).toString('base64').length} caracteres)`);
  } else {
    poner(lineas, 'GOOGLE_SERVICE_ACCOUNT_JSON', unaLinea);
    quitar(lineas, 'GOOGLE_SERVICE_ACCOUNT_FILE');
    ok(`GOOGLE_SERVICE_ACCOUNT_JSON en una sola línea (${unaLinea.length} caracteres)`);
  }

  poner(lineas, 'SHEETS_DRIVER', 'sheets');
  ok('SHEETS_DRIVER=sheets');

  poner(lineas, 'APP_TIMEZONE', 'America/Mexico_City');
  if (!lineas.some(l => /^\s*ALLOWED_ORIGIN=/.test(l))) poner(lineas, 'ALLOWED_ORIGIN', 'http://localhost:4200');

  writeFileSync(ENV, lineas.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trimEnd() + '\n', 'utf8');
  ok(`.env actualizado (${ENV})`);

  console.log('\n=== Falta un paso: compartir la hoja ===');
  console.log('  Abre la hoja → Compartir → pega este correo con permiso EDITOR:\n');
  console.log(`     ${sa.client_email}\n`);
  console.log('  Sin eso, Google responde 403 y la app no puede leer ni escribir.');
  console.log('\n  Luego comprueba la conexión:');
  console.log('     npm run verificar:hoja\n');
}

main();
