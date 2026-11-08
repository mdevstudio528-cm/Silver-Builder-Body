"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const run_1 = require("../_lib/run");
const http_1 = require("../_lib/http");
const auth_1 = require("../_lib/auth");
const store_1 = require("../_lib/store");
const guard_1 = require("../_lib/guard");
exports.default = (0, run_1.run)(async (req, res) => {
    if (!(0, http_1.metodoPermitido)(req, res, ['PATCH', 'POST']))
        return;
    const admin = await (0, guard_1.requireAdmin)(req);
    const b = (0, http_1.requireBody)(req);
    const id = String(b.id || '');
    const accion = String(b.accion || '');
    if (!id)
        throw new http_1.HttpError(400, 'Falta el id del usuario');
    const store = (0, store_1.getStore)();
    const u = await store.findById(id);
    if (!u)
        throw new http_1.HttpError(404, 'Usuario inexistente');
    switch (accion) {
        /* -------- activar / desactivar -------- */
        case 'activar':
        case 'desactivar': {
            if (id === admin.id)
                throw new http_1.HttpError(400, 'No puedes desactivar tu propia cuenta');
            const desactivar = accion === 'desactivar';
            await store.update(id, {
                estatus: desactivar ? 'desactivado' : 'activo',
                // al desactivar se sube la versión de sesión: su cookie deja de valer al instante
                session_version: desactivar ? Number(u.session_version || 1) + 1 : Number(u.session_version || 1),
                intentos_fallidos: 0,
                bloqueado_hasta: ''
            });
            (0, http_1.json)(res, 200, {
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
                const err = (0, auth_1.validarPasswordNueva)(manual, u.correo);
                if (err)
                    throw new http_1.HttpError(400, err);
            }
            const nueva = manual || (0, auth_1.generarPasswordTemporal)();
            await store.update(id, {
                hash: (0, auth_1.hashPassword)(nueva),
                debe_cambiar_pass: 1,
                session_version: Number(u.session_version || 1) + 1,
                intentos_fallidos: 0,
                bloqueado_hasta: ''
            });
            (0, http_1.json)(res, 200, {
                ok: true,
                passwordTemporal: manual ? null : nueva,
                aviso: 'Se cerraron todas sus sesiones. Deberá cambiar la contraseña al entrar.'
            });
            return;
        }
        /* -------- desbloquear por intentos fallidos -------- */
        case 'desbloquear': {
            await store.update(id, { intentos_fallidos: 0, bloqueado_hasta: '' });
            (0, http_1.json)(res, 200, { ok: true, detalle: 'Contador de intentos reiniciado.' });
            return;
        }
        default:
            throw new http_1.HttpError(400, 'Acción no reconocida. Usa: activar, desactivar, reset-pass, desbloquear');
    }
});

/* Vercel / Node: el runtime invoca module.exports directamente, no .default */
if (module.exports && typeof module.exports.default === 'function') module.exports = module.exports.default;
