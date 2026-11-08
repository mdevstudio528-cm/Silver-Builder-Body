"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Metas de ahorro del usuario logueado.
 *   GET  /api/goals  → todas sus metas (incluye las borradas, para propagar el borrado)
 *   POST /api/goals  → sube un lote del outbox local y devuelve la verdad del servidor
 *
 * Mismas garantías que /api/sync: user_id de la cookie, UUID del cliente e
 * idempotencia por updated_at (last-write-wins).
 */
const run_1 = require("./_lib/run");
const http_1 = require("./_lib/http");
const guard_1 = require("./_lib/guard");
const meta_store_1 = require("./_lib/meta.store");
const MAX_OPS = 200;
exports.default = (0, run_1.run)(async (req, res) => {
    if (!(0, http_1.metodoPermitido)(req, res, ['GET', 'POST']))
        return;
    const u = await (0, guard_1.requireUser)(req);
    const store = (0, meta_store_1.getMetaStore)();
    await store.ensureSchema();
    if (req.method === 'GET') {
        const rows = await store.byUser(u.id);
        (0, http_1.json)(res, 200, { ok: true, rows: rows.map(meta_store_1.publicMeta), serverTime: new Date().toISOString() });
        return;
    }
    const body = (0, http_1.requireBody)(req);
    const rows = Array.isArray(body.rows) ? req.body.rows : [];
    if (!Array.isArray(rows))
        throw new http_1.HttpError(400, 'Se esperaba { rows: [] }');
    if (rows.length > MAX_OPS)
        throw new http_1.HttpError(413, `Máximo ${MAX_OPS} metas por lote`);
    const { upserted, skipped } = await store.upsertMany(u.id, rows);
    (0, http_1.json)(res, 200, {
        ok: true,
        upserted,
        skipped,
        rows: (await store.byUser(u.id)).map(meta_store_1.publicMeta),
        serverTime: new Date().toISOString()
    });
});

/* Vercel / Node: el runtime invoca module.exports directamente, no .default */
if (module.exports && typeof module.exports.default === 'function') module.exports = module.exports.default;
