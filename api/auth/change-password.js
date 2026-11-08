"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const run_1 = require("../_lib/run");
const http_1 = require("../_lib/http");
const auth_1 = require("../_lib/auth");
const store_1 = require("../_lib/store");
const guard_1 = require("../_lib/guard");
exports.default = (0, run_1.run)(async (req, res) => {
    if (!(0, http_1.metodoPermitido)(req, res, ['POST']))
        return;
    const u = await (0, guard_1.requireUser)(req);
    const body = (0, http_1.requireBody)(req);
    const actual = String(body.actual || '');
    const nueva = String(body.nueva || '');
    if (!(0, auth_1.verifyPassword)(actual, u.hash))
        throw new http_1.HttpError(400, 'La contraseña actual no es correcta');
    const error = (0, auth_1.validarPasswordNueva)(nueva, u.correo);
    if (error)
        throw new http_1.HttpError(400, error);
    if (nueva === actual)
        throw new http_1.HttpError(400, 'La nueva contraseña debe ser diferente a la actual');
    // sube la versión de sesión → muere cualquier otra sesión abierta en otro dispositivo
    const nuevaVersion = Number(u.session_version || 1) + 1;
    await (0, store_1.getStore)().update(u.id, {
        hash: (0, auth_1.hashPassword)(nueva),
        debe_cambiar_pass: 0,
        session_version: nuevaVersion
    });
    // esta sesión sigue viva, con la versión nueva
    res.setHeader('Set-Cookie', (0, http_1.serializeCookie)(guard_1.COOKIE, (0, auth_1.signSession)(u.id, nuevaVersion), (0, http_1.cookieOptions)(7 * 86400)));
    (0, http_1.json)(res, 200, {
        ok: true,
        user: (0, guard_1.publicUser)({ ...u, debe_cambiar_pass: 0, session_version: nuevaVersion }),
        mensaje: 'Contraseña actualizada. Las demás sesiones se cerraron.'
    });
});

/* Vercel / Node: el runtime invoca module.exports directamente, no .default */
if (module.exports && typeof module.exports.default === 'function') module.exports = module.exports.default;
