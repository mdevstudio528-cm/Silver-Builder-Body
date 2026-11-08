import { run } from '../_lib/run';
import { HttpError, json, requireBody, metodoPermitido, serializeCookie, cookieOptions } from '../_lib/http';
import { hashPassword, verifyPassword, validarPasswordNueva, signSession } from '../_lib/auth';
import { getStore } from '../_lib/store';
import { COOKIE, requireUser, publicUser } from '../_lib/guard';

export default run(async (req, res) => {
  if (!metodoPermitido(req, res, ['POST'])) return;

  const u = await requireUser(req);
  const body = requireBody(req);
  const actual = String(body.actual || '');
  const nueva = String(body.nueva || '');

  if (!verifyPassword(actual, u.hash)) throw new HttpError(400, 'La contraseña actual no es correcta');

  const error = validarPasswordNueva(nueva, u.correo);
  if (error) throw new HttpError(400, error);
  if (nueva === actual) throw new HttpError(400, 'La nueva contraseña debe ser diferente a la actual');

  // sube la versión de sesión → muere cualquier otra sesión abierta en otro dispositivo
  const nuevaVersion = Number(u.session_version || 1) + 1;
  await getStore().update(u.id, {
    hash: hashPassword(nueva),
    debe_cambiar_pass: 0,
    session_version: nuevaVersion
  });

  // esta sesión sigue viva, con la versión nueva
  res.setHeader('Set-Cookie', serializeCookie(COOKIE, signSession(u.id, nuevaVersion), cookieOptions(7 * 86400)));
  json(res, 200, {
    ok: true,
    user: publicUser({ ...u, debe_cambiar_pass: 0, session_version: nuevaVersion }),
    mensaje: 'Contraseña actualizada. Las demás sesiones se cerraron.'
  });
});
