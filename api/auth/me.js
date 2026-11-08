"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const run_1 = require("../_lib/run");
const http_1 = require("../_lib/http");
const guard_1 = require("../_lib/guard");
exports.default = (0, run_1.run)(async (req, res) => {
    if (!(0, http_1.metodoPermitido)(req, res, ['GET']))
        return;
    const u = await (0, guard_1.requireUser)(req);
    (0, http_1.json)(res, 200, { ok: true, user: (0, guard_1.publicUser)(u), debeCambiarPass: Number(u.debe_cambiar_pass) === 1 });
});

/* Vercel / Node: el runtime invoca module.exports directamente, no .default */
if (module.exports && typeof module.exports.default === 'function') module.exports = module.exports.default;
