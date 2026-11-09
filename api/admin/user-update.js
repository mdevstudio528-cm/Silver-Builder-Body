"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * POST /api/admin/user-update
 *
 * Acciones sobre UN usuario. Todas por requireAdmin.
 *   editar      → cambia nombre, apellidos, teléfono, correo y rol (lista blanca)
 *   activar     → vuelve a dar acceso
 *   desactivar  → corta la sesión al instante (sube session_version)
 *   reset-pass  → nueva contraseña temporal y cierra sus sesiones
 *   desbloquear → limpia el contador de intentos fallidos
 *   eliminar    → BORRADO DEFINITIVO con cascada:
 *                 movimientos, metas y pagos de ese usuario, y su fila
 */
const run_1 = require("../_lib/run");
const http_1 = require("../_lib/http");
const auth_1 = require("../_lib/auth");
const store_1 = require("../_lib/store");
const guard_1 = require("../_lib/guard");
const borrado_1 = require("../_lib/borrado");
const CORREO_OK = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;
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
        /* ------------------------------ EDITAR ------------------------------ */
        case 'editar': {
            const patch = {};
            if (b.nombre !== undefined) {
                const nombre = String(b.nombre).trim();
                if (!nombre)
                    throw new http_1.HttpError(400, 'El nombre no puede quedar vacío');
                patch.nombre = nombre.slice(0, 60);
            }
            if (b.ap_paterno !== undefined) {
                const ap = String(b.ap_paterno).trim();
                if (!ap)
                    throw new http_1.HttpError(400, 'El apellido paterno no puede quedar vacío');
                patch.ap_paterno = ap.slice(0, 60);
            }
            if (b.ap_materno !== undefined)
                patch.ap_materno = String(b.ap_materno).trim().slice(0, 60);
            if (b.telefono !== undefined) {
                const tel = String(b.telefono).replace(/[^\d]/g, '');
                if (tel.length < 10)
                    throw new http_1.HttpError(400, 'El teléfono debe tener al menos 10 dígitos');
                patch.telefono = tel.slice(0, 15);
            }
            if (b.correo !== undefined) {
                const correo = String(b.correo).trim().toLowerCase();
                if (!CORREO_OK.test(correo))
                    throw new http_1.HttpError(400, 'Correo inválido');
                if (correo !== String(u.correo).toLowerCase()) {
                    const ocupado = await store.findByEmail(correo);
                    if (ocupado && ocupado.id !== id)
                        throw new http_1.HttpError(409, 'Ya existe otra cuenta con ese correo');
                    patch.correo = correo;
                    // el correo es la llave de acceso: si cambia, sus sesiones viejas mueren
                    patch.session_version = Number(u.session_version || 1) + 1;
                }
            }
            if (b.rol !== undefined) {
                const rol = b.rol === 'admin' ? 'admin' : 'user';
                if (id === admin.id && rol !== 'admin')
                    throw new http_1.HttpError(400, 'No puedes quitarte a ti mismo el rol de administrador');
                patch.rol = rol;
            }
            if (!Object.keys(patch).length)
                throw new http_1.HttpError(400, 'No enviaste ningún campo para editar');
            await store.update(id, patch);
            (0, http_1.json)(res, 200, {
                ok: true,
                detalle: 'Datos actualizados.',
                user: { id, ...patch, hash: undefined }
            });
            return;
        }
        /* ------------------------ activar / desactivar ------------------------ */
        case 'activar':
        case 'desactivar': {
            if (id === admin.id)
                throw new http_1.HttpError(400, 'No puedes desactivar tu propia cuenta');
            const desactivar = accion === 'desactivar';
            await store.update(id, {
                estatus: desactivar ? 'desactivado' : 'activo',
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
        /* --------------------------- reset de clave --------------------------- */
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
        /* ------------------------------ desbloquear ------------------------------ */
        case 'desbloquear': {
            await store.update(id, { intentos_fallidos: 0, bloqueado_hasta: '' });
            (0, http_1.json)(res, 200, { ok: true, detalle: 'Contador de intentos reiniciado.' });
            return;
        }
        /* ---------------------- ELIMINAR (borrado en cascada) ---------------------- */
        case 'eliminar': {
            if (id === admin.id)
                throw new http_1.HttpError(400, 'No puedes eliminar tu propia cuenta');
            if (b.confirmar !== id)
                throw new http_1.HttpError(400, 'Confirmación incorrecta: envía "confirmar" con el id del usuario.');
            const r = await (0, borrado_1.borrarUsuarioCompleto)(id);
            (0, http_1.json)(res, 200, {
                ok: true,
                eliminado: { correo: u.correo, nombre: `${u.nombre} ${u.ap_paterno}`.trim(), id },
                movimientos: r.movimientos,
                metas: r.metas,
                pagos: r.pagos,
                detalle: r.detalle
            });
            return;
        }
        default:
            throw new http_1.HttpError(400, 'Acción no reconocida. Usa: editar, activar, desactivar, reset-pass, desbloquear, eliminar');
    }
});

if (module.exports && typeof module.exports.default === 'function') module.exports = module.exports.default;
