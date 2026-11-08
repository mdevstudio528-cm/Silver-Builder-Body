/**
 * Metas de ahorro del usuario logueado.
 *   GET  /api/goals  → todas sus metas (incluye las borradas, para propagar el borrado)
 *   POST /api/goals  → sube un lote del outbox local y devuelve la verdad del servidor
 *
 * Mismas garantías que /api/sync: user_id de la cookie, UUID del cliente e
 * idempotencia por updated_at (last-write-wins).
 */
import { run } from './_lib/run';
import { HttpError, json, requireBody, metodoPermitido } from './_lib/http';
import { requireUser } from './_lib/guard';
import { getMetaStore, publicMeta } from './_lib/meta.store';

const MAX_OPS = 200;

export default run(async (req, res) => {
  if (!metodoPermitido(req, res, ['GET', 'POST'])) return;

  const u = await requireUser(req);
  const store = getMetaStore();
  await store.ensureSchema();

  if (req.method === 'GET') {
    const rows = await store.byUser(u.id);
    json(res, 200, { ok: true, rows: rows.map(publicMeta), serverTime: new Date().toISOString() });
    return;
  }

  const body = requireBody(req);
  const rows = Array.isArray(body.rows) ? req.body.rows : [];
  if (!Array.isArray(rows)) throw new HttpError(400, 'Se esperaba { rows: [] }');
  if (rows.length > MAX_OPS) throw new HttpError(413, `Máximo ${MAX_OPS} metas por lote`);

  const { upserted, skipped } = await store.upsertMany(u.id, rows);

  json(res, 200, {
    ok: true,
    upserted,
    skipped,
    rows: (await store.byUser(u.id)).map(publicMeta),
    serverTime: new Date().toISOString()
  });
});
