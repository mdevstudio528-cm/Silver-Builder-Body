"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COOKIE = void 0;
exports.requireUser = requireUser;
exports.requireAdmin = requireAdmin;
exports.publicUser = publicUser;
/**
 * El portero. Relee la fila del usuario en CADA request: no confía en el token
 * para el estatus ni para la versión de sesión. Eso es lo que hace que desactivar
 * a alguien surta efecto inmediato en vez de "cuando caduque su sesión".
 */
const http_1 = require("./http");
const auth_1 = require("./auth");
const store_1 = require("./store");
exports.COOKIE = 'afur_session';
async function requireUser(req) {
    const cookies = req.cookies ?? (0, http_1.parseCookies)(String(req.headers?.cookie || ''));
    const claims = (0, auth_1.verifySession)(cookies[exports.COOKIE]);
    const u = await (0, store_1.getStore)().findById(claims.uid);
    if (!u)
        throw new http_1.HttpError(401, 'Sesión inválida');
    if (String(u.estatus) !== 'activo')
        throw new http_1.HttpError(403, 'Cuenta desactivada');
    if (Number(u.session_version) !== Number(claims.sv))
        throw new http_1.HttpError(401, 'Sesión cerrada por el administrador');
    return u;
}
async function requireAdmin(req) {
    const u = await requireUser(req);
    if (u.rol !== 'admin')
        throw new http_1.HttpError(403, 'Solo administradores');
    return u;
}
/** Datos que el navegador SÍ puede ver. Nunca incluye hash ni contadores internos. */
function publicUser(u) {
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
