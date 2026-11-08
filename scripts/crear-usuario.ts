/**
 * Da de alta a un cliente. Imprime la contraseña temporal UNA vez.
 * Uso: npm run crear:usuario -- --correo ana@mail.com --nombre Ana --paterno Ruiz --materno Mena --telefono 7712345678
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
const nombre = arg('nombre', '');
const paterno = arg('paterno', '');
const materno = arg('materno', '');
const telefono = String(arg('telefono', '')).replace(/\D/g, '');

if (!correo || !nombre || !paterno) {
  console.error('Faltan datos. Ejemplo:\n  npm run crear:usuario -- --correo ana@mail.com --nombre Ana --paterno Ruiz --telefono 7712345678');
  process.exit(1);
}

const manual = arg('password', '');
if (manual) {
  const err = validarPasswordNueva(manual, correo);
  if (err) { console.error('✗ ' + err); process.exit(1); }
}
const password = manual || generarPasswordTemporal();

async function main() {
  const store = getStore();
  await store.ensureSchema();

  if (await store.findByEmail(correo)) {
    console.error(`✗ Ya existe una cuenta con ${correo}`);
    process.exit(1);
  }

  await store.insert({
    id: 'u_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4),
    nombre, ap_paterno: paterno, ap_materno: materno, telefono,
    correo, hash: hashPassword(password),
    estatus: 'activo', rol: 'user',
    fecha_alta: hoyISO(), ultimo_acceso: '',
    debe_cambiar_pass: 1, session_version: 1,
    intentos_fallidos: 0, bloqueado_hasta: ''
  });

  console.log(`\n  driver: ${driverActual()}`);
  console.log(`  ✓ usuario creado: ${correo}`);
  console.log(`  ✓ contraseña temporal: ${password}  ← se muestra solo ahora\n`);
  console.log(`  El usuario deberá cambiarla en su primer acceso.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
