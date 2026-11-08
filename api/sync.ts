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
import { run } from './_lib/run';
import { HttpError, json, requireBody, metodoPermitido } from './_lib/http';
import { requireUser } from './_lib/guard';
import { getMovStore, publicRow } from './_lib/mov.store';

const MAX_OPS = 500;

export default run(async (req, res) => {
  if (!metodoPermitido(req, res, ['GET', 'POST'])) return;

  const u = await requireUser(req);
  const store = getMovStore();
  await store.ensureSchema();

  if (req.method === 'GET') {
    const rows = await getMovStore().byUser(u.id);
    json(res, 200, { ok: true, rows: rows.map(publicRow), serverTime: new Date().toISOString() });
    return;
  }

  const body = requireBody(req);
  const rows = Array.isArray(body.rows) ? req.body.rows : [];
  if (!Array.isArray(rows)) throw new HttpError(400, 'Se esperaba { rows: [] }');
  if (rows.length > MAX_OPS) throw new HttpError(413, `Máximo ${MAX_OPS} movimientos por lote`);

  const { upserted, skipped } = await store.upsertMany(u.id, rows);

  json(res, 200, {
    ok: true,
    upserted,
    skipped,
    rows: (await getMovStore().byUser(u.id)).map(publicRow),
    serverTime: new Date().toISOString()
  });
});
