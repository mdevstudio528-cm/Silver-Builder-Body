/**
 * Crea (o actualiza) tu cuenta de administrador.
 * Uso:  npm run seed:admin -- --correo tu@correo.com --password "MiPass123" --nombre Moises --paterno Meyer
 * Si omites --password, se genera una y se imprime una sola vez.
 */
import './_env';
import { hashPassword, generarPasswordTemporal, validarPasswordNueva } from '../api/_lib/auth';
import { getStore, driverActual } from '../api/_lib/store';
import { hoyISO } from '../api/_lib/http';

const args = process.argv.slice(2);
const arg = (n: string, def = '') => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const correo = String(arg('correo') || '').trim().toLowerCase();
const nombre = arg('nombre', 'Administrador');
const paterno = arg('paterno', '');
const materno = arg('materno', '');
const telefono = String(arg('telefono', '')).replace(/\D/g, '');

if (!correo) {
  console.error('Falta --correo. Ejemplo: npm run seed:admin -- --correo yo@correo.com');
  process.exit(1);
}

const manual = arg('password', '');
if (manual) {
  const err = validarPasswordNueva(manual, correo);
  if (err) { console.error('✗ ' + err); process.exit(1); }
}
const password = manual || generarPasswordTemporal(14);

async function main() {
  // el driver se imprime ANTES de escribir: así ves a dónde va la cuenta
  const drv = driverActual();
  console.log(`\n  driver: ${drv}`);
  if (drv === 'file' && process.env.SHEET_ID) {
    console.warn('  ! SHEET_ID está configurado pero SHEETS_DRIVER no dice "sheets".');
    console.warn('    Esta cuenta se guardaría en data/users.json y el login (sheets) NO la vería.');
    console.warn('    Corrige el .env con:  node arreglar-env.mjs');
    process.exit(1);
  }

  const store = getStore();
  await store.ensureSchema();

  const nuevoId = () => 'u_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const existente = await store.findByEmail(correo);

  const fila = {
    id: existente?.id || nuevoId(),
    nombre, ap_paterno: paterno, ap_materno: materno, telefono,
    correo, hash: hashPassword(password),
    estatus: 'activo' as const, rol: 'admin' as const,
    fecha_alta: existente?.fecha_alta || hoyISO(),
    ultimo_acceso: '',
    // el admin no tiene que cambiar su propia contraseña si la elegiste tú
    debe_cambiar_pass: manual ? 0 : 1,
    session_version: Number(existente?.session_version || 0) + 1,
    intentos_fallidos: 0, bloqueado_hasta: ''
  };

  if (existente) await store.update(fila.id, fila as any);
  else await store.insert(fila);

  console.log(`  ✓ escrita en: ${drv === 'sheets' ? 'hoja de Google, pestaña "usuarios"' : 'data/users.json (local)'}`);
  console.log(`  ✓ admin ${existente ? 'actualizado' : 'creado'}: ${correo}`);
  console.log(`  ✓ contraseña: ${password}${manual ? ' (la que elegiste)' : '  ← GUÁRDALA, no se vuelve a mostrar'}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
