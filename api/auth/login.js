"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const run_1 = require("../_lib/run");
const http_1 = require("../_lib/http");
const auth_1 = require("../_lib/auth");
const store_1 = require("../_lib/store");
const guard_1 = require("../_lib/guard");
const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;
exports.default = (0, run_1.run)(async (req, res) => {
    if (!(0, http_1.metodoPermitido)(req, res, ['POST']))
        return;
    const body = (0, http_1.requireBody)(req);
    const correo = String(body.correo || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!correo || !password)
        throw new http_1.HttpError(400, 'Escribe tu correo y contraseña');
    const store = (0, store_1.getStore)();
    const u = await store.findByEmail(correo);
    // Bloqueo por fuerza bruta (se revisa antes de gastar CPU en scrypt)
    if (u && u.bloqueado_hasta && Date.parse(u.bloqueado_hasta) > Date.now()) {
        const min = Math.ceil((Date.parse(u.bloqueado_hasta) - Date.now()) / 60000);
        throw new http_1.HttpError(429, `Demasiados intentos. Intenta de nuevo en ${min} minuto(s).`);
    }
    // Hash señuelo: si el correo no existe se ejecuta igual el cálculo de scrypt,
    // y así el tiempo de respuesta no revela qué correos están dados de alta.
    const señuelo = 'scrypt$16384$8$1$' + Buffer.alloc(16).toString('base64') + '$' + Buffer.alloc(32).toString('base64');
    const passwordOk = (0, auth_1.verifyPassword)(password, u?.hash || señuelo);
    if (!u || !passwordOk) {
        if (u) {
            const intentos = Number(u.intentos_fallidos || 0) + 1;
            const patch = { intentos_fallidos: intentos };
            if (intentos >= MAX_INTENTOS) {
                patch.bloqueado_hasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60000).toISOString();
                patch.intentos_fallidos = 0;
            }
            await store.update(u.id, patch);
        }
        throw new http_1.HttpError(401, 'Correo o contraseña incorrectos');
    }
    // Ya demostró que es él: hasta aquí se revela el estatus
    if (String(u.estatus) !== 'activo') {
        throw new http_1.HttpError(403, 'Cuenta desactivada. Contacta al administrador para reactivarla.');
    }
    const token = (0, auth_1.signSession)(u.id, Number(u.session_version || 1));
    res.setHeader('Set-Cookie', (0, http_1.serializeCookie)(guard_1.COOKIE, token, (0, http_1.cookieOptions)(7 * 86400)));
    await store.update(u.id, {
        ultimo_acceso: new Date().toISOString().slice(0, 16).replace('T', ' '),
        intentos_fallidos: 0,
        bloqueado_hasta: ''
    });
    (0, http_1.json)(res, 200, {
        ok: true,
        user: (0, guard_1.publicUser)({ ...u, ultimo_acceso: (0, http_1.hoyISO)() }),
        debeCambiarPass: Number(u.debe_cambiar_pass) === 1
    });
});

if (module.exports && typeof module.exports.default === 'function') module.exports = module.exports.default;
