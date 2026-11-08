/**
 * El portero. Relee la fila del usuario en CADA request: no confía en el token
 * para el estatus ni para la versión de sesión. Eso es lo que hace que desactivar
 * a alguien surta efecto inmediato en vez de "cuando caduque su sesión".
 */
import { HttpError, parseCookies, type Req } from './http';
import { verifySession } from './auth';
import { getStore } from './store';
import type { UserRow } from './users.types';

export const COOKIE = 'afur_session';

export async function requireUser(req: Req): Promise<UserRow> {
  const cookies = req.cookies ?? parseCookies(String(req.headers?.cookie || ''));
  const claims = verifySession(cookies[COOKIE]);

  const u = await getStore().findById(claims.uid);
  if (!u) throw new HttpError(401, 'Sesión inválida');
  if (String(u.estatus) !== 'activo') throw new HttpError(403, 'Cuenta desactivada');
  if (Number(u.session_version) !== Number(claims.sv))
    throw new HttpError(401, 'Sesión cerrada por el administrador');
  return u;
}

export async function requireAdmin(req: Req): Promise<UserRow> {
  const u = await requireUser(req);
  if (u.rol !== 'admin') throw new HttpError(403, 'Solo administradores');
  return u;
}

/** Datos que el navegador SÍ puede ver. Nunca incluye hash ni contadores internos. */
export function publicUser(u: UserRow) {
  return {
    id: u.id,
    nombre: u.nombre,
    ap_paterno: u.ap_paterno,
    ap_materno: u.ap_materno,
    telefono: u.telefono,
    correo: u.correo,
    rol: u.rol,
    estatus: u.estatus,
    fecha_alta: u.fecha_alta,
    ultimo_acceso: u.ultimo_acceso,
    debeCambiarPass: Number(u.debe_cambiar_pass) === 1
  };
}
