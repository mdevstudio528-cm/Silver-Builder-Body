import { run } from '../_lib/run';
import { HttpError, json, requireBody, metodoPermitido } from '../_lib/http';
import { hashPassword, generarPasswordTemporal, validarPasswordNueva } from '../_lib/auth';
import { getStore } from '../_lib/store';
import { requireAdmin } from '../_lib/guard';

export default run(async (req, res) => {
  if (!metodoPermitido(req, res, ['PATCH', 'POST'])) return;
  const admin = await requireAdmin(req);

  const b = requireBody(req);
  const id = String(b.id || '');
  const accion = String(b.accion || '');
  if (!id) throw new HttpError(400, 'Falta el id del usuario');

  const store = getStore();
  const u = await store.findById(id);
  if (!u) throw new HttpError(404, 'Usuario inexistente');

  switch (accion) {
    /* -------- activar / desactivar -------- */
    case 'activar':
    case 'desactivar': {
      if (id === admin.id) throw new HttpError(400, 'No puedes desactivar tu propia cuenta');
      const desactivar = accion === 'desactivar';
      await store.update(id, {
        estatus: desactivar ? 'desactivado' : 'activo',
        // al desactivar se sube la versión de sesión: su cookie deja de valer al instante
        session_version: desactivar ? Number(u.session_version || 1) + 1 : Number(u.session_version || 1),
        intentos_fallidos: 0,
        bloqueado_hasta: ''
      });
      json(res, 200, {
        ok: true,
        estatus: desactivar ? 'desactivado' : 'activo',
        detalle: desactivar
          ? 'Sesión invalidada. Su siguiente petición recibirá 403.'
          : 'Puede volver a iniciar sesión.'
      });
      return;
    }

    /* -------- reset de contraseña -------- */
    case 'reset-pass': {
      const manual = b.password ? String(b.password) : '';
      if (manual) {
        const err = validarPasswordNueva(manual, u.correo);
        if (err) throw new HttpError(400, err);
      }
      const nueva = manual || generarPasswordTemporal();
      await store.update(id, {
        hash: hashPassword(nueva),
        debe_cambiar_pass: 1,
        session_version: Number(u.session_version || 1) + 1,
        intentos_fallidos: 0,
        bloqueado_hasta: ''
      });
      json(res, 200, {
        ok: true,
        passwordTemporal: manual ? null : nueva,
        aviso: 'Se cerraron todas sus sesiones. Deberá cambiar la contraseña al entrar.'
      });
      return;
    }

    /* -------- desbloquear por intentos fallidos -------- */
    case 'desbloquear': {
      await store.update(id, { intentos_fallidos: 0, bloqueado_hasta: '' });
      json(res, 200, { ok: true, detalle: 'Contador de intentos reiniciado.' });
      return;
    }

    default:
      throw new HttpError(400, 'Acción no reconocida. Usa: activar, desactivar, reset-pass, desbloquear');
  }
});
