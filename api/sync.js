"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * El único punto por donde entran y salen los movimientos.
 *   GET  /api/sync  → todo lo del usuario logueado (para otra PC o tras reinstalar)
 *   POST /api/sync  → sube un lote del outbox local y devuelve la verdad del servidor
 *
 * Tres garantías:
 *   1. user_id sale de la cookie firmada, JAMÁS del cuerpo → nadie escribe en la cuenta de otro.
 *   2. Cada fila tiene UUID del cliente e updated_at → subir dos veces no duplica nada.
 *   3. Borrar = deleted=1 (tombstone). La fila se conserva para que el borrado también se propague.
 */
const run_1 = require("./_lib/run");
const http_1 = require("./_lib/http");
const guard_1 = require("./_lib/guard");
const mov_store_1 = require("./_lib/mov.store");
const MAX_OPS = 500;
exports.default = (0, run_1.run)(async (req, res) => {
    if (!(0, http_1.metodoPermitido)(req, res, ['GET', 'POST']))
        return;
    const u = await (0, guard_1.requireUser)(req);
    const store = (0, mov_store_1.getMovStore)();
    await store.ensureSchema();
    if (req.method === 'GET') {
        const rows = await (0, mov_store_1.getMovStore)().byUser(u.id);
        (0, http_1.json)(res, 200, { ok: true, rows: rows.map(mov_store_1.publicRow), serverTime: new Date().toISOString() });
        return;
    }
    const body = (0, http_1.requireBody)(req);
    const rows = Array.isArray(body.rows) ? req.body.rows : [];
    if (!Array.isArray(rows))
        throw new http_1.HttpError(400, 'Se esperaba { rows: [] }');
    if (rows.length > MAX_OPS)
        throw new http_1.HttpError(413, `Máximo ${MAX_OPS} movimientos por lote`);
    const { upserted, skipped } = await store.upsertMany(u.id, rows);
    (0, http_1.json)(res, 200, {
        ok: true,
        upserted,
        skipped,
        rows: (await (0, mov_store_1.getMovStore)().byUser(u.id)).map(mov_store_1.publicRow),
        serverTime: new Date().toISOString()
    });
});

/* Vercel / Node: el runtime invoca module.exports directamente, no .default */
if (module.exports && typeof module.exports.default === 'function') module.exports = module.exports.default;
