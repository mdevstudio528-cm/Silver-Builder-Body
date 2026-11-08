"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
/** Envuelve un handler: CORS + manejo uniforme de errores. */
const http_1 = require("./http");
function run(fn) {
    return async (req, res) => {
        (0, http_1.setCors)(req, res);
        try {
            await fn(req, res);
        }
        catch (e) {
            const status = e instanceof http_1.HttpError ? e.status : 500;
            const cuerpo = {
                ok: false,
                error: e?.message || 'Error interno',
                // 'pista' viene de SheetsError: es el texto accionable (403 = falta compartir)
                pista: e?.pista || undefined,
                detail: e?.detail || undefined
            };
            try {
                (0, http_1.json)(res, status, cuerpo);
            }
            catch {
                // el manejo del error nunca debe tumbar la función
                const r = res;
                r.statusCode = status;
                try {
                    if (typeof r.setHeader === 'function')
                        r.setHeader('Content-Type', 'application/json; charset=utf-8');
                }
                catch { }
                try {
                    if (typeof r.end === 'function')
                        r.end(JSON.stringify(cuerpo));
                }
                catch { }
            }
        }
    };
}
