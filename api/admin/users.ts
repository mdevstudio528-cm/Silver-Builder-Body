import { run } from '../_lib/run';
import { HttpError, json, requireBody, metodoPermitido, hoyISO } from '../_lib/http';
import { hashPassword, generarPasswordTemporal, validarPasswordNueva } from '../_lib/auth';
import { getStore } from '../_lib/store';
import { requireAdmin } from '../_lib/guard';
import type { UserRow } from '../_lib/users.types';

const nuevoId = () => 'u_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export default run(async (req, res) => {
  if (!metodoPermitido(req, res, ['GET', 'POST'])) return;
  await requireAdmin(req);

  const store = getStore();

  /* ---------------------------- LISTAR ---------------------------- */
  if (req.method === 'GET') {
    const filas = await store.listUsers();
    json(res, 200, {
      ok: true,
      total: filas.length,
      resumen: {
        activos: filas.filter(u => u.estatus === 'activo').length,
        desactivados: filas.filter(u => u.estatus !== 'activo').length,
        admins: filas.filter(u => u.rol === 'admin').length
      },
      users: filas.map(u => ({
        id: u.id, nombre: u.nombre, apellido: `${u.ap_paterno} ${u.ap_materno}`.trim(),
        telefono: u.telefono, correo: u.correo, estatus: u.estatus, rol: u.rol,
        fecha_alta: u.fecha_alta, ultimo_acceso: u.ultimo_acceso || '—',
        debeCambiarPass: Number(u.debe_cambiar_pass) === 1
      }))
    });
    return;
  }

  /* ---------------------------- CREAR ----------------------------- */
  const b = requireBody(req);
  const nombre = String(b.nombre || '').trim();
  const ap_paterno = String(b.ap_paterno || '').trim();
  const ap_materno = String(b.ap_materno || '').trim();
  const telefono = String(b.telefono || '').replace(/[^\d]/g, '');
  const correo = String(b.correo || '').trim().toLowerCase();
  const rol = b.rol === 'admin' ? 'admin' : 'user';

  if (!nombre) throw new HttpError(400, 'Falta el nombre');
  if (!ap_paterno) throw new HttpError(400, 'Falta el apellido paterno');
  if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(correo)) throw new HttpError(400, 'Correo inválido');
  if (telefono.length < 10) throw new HttpError(400, 'El teléfono debe tener al menos 10 dígitos');

  const existente = await store.findByEmail(correo);
  if (existente) throw new HttpError(409, 'Ya existe una cuenta con ese correo');

  // Contraseña: la que tú escribas, o una temporal generada por el sistema
  const passwordManual = b.password ? String(b.password) : '';
  if (passwordManual) {
    const err = validarPasswordNueva(passwordManual, correo);
    if (err) throw new HttpError(400, err);
  }
  const password = passwordManual || generarPasswordTemporal();

  const fila: UserRow = {
    id: nuevoId(),
    nombre,
    ap_paterno,
    ap_materno,
    telefono,
    correo,
    hash: hashPassword(password),
    estatus: 'activo',
    rol,
    fecha_alta: hoyISO(),
    ultimo_acceso: '',
    // siempre obliga a cambiar la contraseña al primer acceso
    debe_cambiar_pass: 1,
    session_version: 1,
    intentos_fallidos: 0,
    bloqueado_hasta: ''
  };

  await store.insert(fila);

  // La contraseña se muestra UNA sola vez y no se guarda en claro en ningún lado
  json(res, 201, {
    ok: true,
    user: { id: fila.id, nombre, correo, rol, estatus: 'activo' },
    passwordTemporal: passwordManual ? null : password,
    passwordElegida: passwordManual || null,
    aviso: 'Guarda esta contraseña ahora: no se puede volver a mostrar. El usuario deberá cambiarla al entrar.'
  });
});
