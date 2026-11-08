/**
 * /api/admin/pagos
 *
 *   GET  ?user_id=u_xxx   → historial de un cliente (o los últimos 50 si no se pasa)
 *   POST { accion: 'cobrar', user_id, monto, meses, metodo, notas, fecha_pago?, reactivar? }
 *   POST { accion: 'anular', id }
 *
 * El periodo (desde/hasta) lo calcula el SERVIDOR con el historial real:
 * si el cliente sigue cubierto, el nuevo pago arranca donde termina el anterior;
 * si ya venció, arranca hoy. Nunca se confía en fechas que manda el navegador.
 */
import { run } from '../_lib/run';
import { HttpError, json, requireBody, metodoPermitido, hoyISO } from '../_lib/http';
import { getStore } from '../_lib/store';
import { getPagoStore, normalizarPago, publicPago } from '../_lib/pago.store';
import { requireAdmin } from '../_lib/guard';
import { calcularPeriodo, resumenCliente, ultimoCobro } from '../_lib/cobranza';
import { fechaValida } from '../_lib/fechas';
import { METODOS } from '../_lib/pago.types';

const nuevoId = () => 'pg_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export default run(async (req, res) => {
  if (!metodoPermitido(req, res, ['GET', 'POST'])) return;
  await requireAdmin(req);

  const pagosStore = getPagoStore();
  const hoy = hoyISO();

  /* ------------------------------ LISTAR ------------------------------ */
  if (req.method === 'GET') {
    const userId = String((req.query?.user_id as string) || '');
    const pagos = userId
      ? await pagosStore.byUser(userId)
      : (await pagosStore.listAll()).sort((a, b) => String(b.fecha_pago).localeCompare(String(a.fecha_pago))).slice(0, 50);

    json(res, 200, {
      ok: true,
      hoy,
      total: pagos.length,
      pagos: pagos.filter(p => Number(p.deleted) !== 1).map(publicPago),
      resumen: userId ? resumenCliente(userId, pagos, hoy) : null
    });
    return;
  }

  /* ------------------------------ ESCRIBIR ------------------------------ */
  const b = requireBody(req);
  const accion = String(b.accion || 'cobrar');

  /* -------- anular un cobro -------- */
  if (accion === 'anular') {
    const id = String(b.id || '').trim();
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new HttpError(400, 'Falta el id del pago');
    const todos = await pagosStore.listAll();
    const p = todos.find(x => x.id === id);
    if (!p) throw new HttpError(404, 'Pago inexistente');

    await pagosStore.update(id, { deleted: 1, updated_at: new Date().toISOString() });

    // el cliente vuelve a quedar como estaba antes de ese cobro
    // (solo SUS pagos: si no se filtra por user_id, se mezclan los de otros clientes)
    const restantes = todos.filter(x => x.id !== id && x.user_id === p.user_id);
    const r = resumenCliente(p.user_id, restantes, hoy);
    json(res, 200, {
      ok: true,
      anulado: id,
      resumen: r,
      detalle: r.cubierto_hasta
        ? `Cobro anulado. Antes quedaba cubierto hasta ${p.periodo_hasta}; ahora hasta ${r.cubierto_hasta}.`
        : `Cobro anulado. ${p.periodo_hasta} era su última cobertura: ahora queda sin pagos registrados.`
    });
    return;
  }

  /* -------- registrar un cobro -------- */
  if (accion !== 'cobrar') throw new HttpError(400, 'Acción no reconocida. Usa: cobrar, anular');

  const userId = String(b.user_id || '').trim();
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(userId)) throw new HttpError(400, 'Falta el cliente (user_id)');

  const u = await getStore().findById(userId);
  if (!u) throw new HttpError(404, 'Cliente inexistente');
  if (u.rol === 'admin') throw new HttpError(400, 'El administrador no se cobra a sí mismo');

  const meses = Math.trunc(Number(b.meses ?? 1));
  if (!isFinite(meses) || meses < 1 || meses > 60) throw new HttpError(400, 'Los meses deben ir de 1 a 60');

  const fechaPago = fechaValida(String(b.fecha_pago || '')) ? String(b.fecha_pago) : hoy;

  // monto: el que escribas; si no, se reusa su última mensualidad
  const propios = await pagosStore.byUser(userId);
  const previo = ultimoCobro(propios);
  const mensualidadPrevia = previo ? Number(previo.monto) / Math.max(1, Number(previo.meses) || 1) : 0;
  const monto = Number(b.monto) > 0 ? Number(b.monto) : mensualidadPrevia * meses;
  if (!isFinite(monto) || monto <= 0) {
    throw new HttpError(400, 'Escribe el monto: este cliente no tiene una mensualidad previa de la cual tomarlo');
  }

  const metodo = String(b.metodo || 'efectivo').toLowerCase();
  const metodoFinal = (METODOS as readonly string[]).includes(metodo) ? metodo : 'otro';

  const { desde, hasta } = calcularPeriodo(propios, hoy, meses);

  const fila = normalizarPago(
    {
      id: nuevoId(),
      fecha_pago: fechaPago,
      monto,
      metodo: metodoFinal as any,
      meses,
      periodo_desde: desde,
      periodo_hasta: hasta,
      notas: String(b.notas || ''),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    userId
  );
  if (!fila) throw new HttpError(400, 'Los datos del cobro no son válidos');

  await pagosStore.insert(fila);

  /* reactivar la cuenta en el mismo paso, si lo pediste */
  let reactivado = false;
  if (b.reactivar === true && String(u.estatus) !== 'activo') {
    await getStore().update(userId, { estatus: 'activo', intentos_fallidos: 0, bloqueado_hasta: '' });
    reactivado = true;
  }

  json(res, 201, {
    ok: true,
    pago: publicPago(fila),
    resumenAnterior: resumenCliente(userId, propios, hoy),
    nuevoResumen: resumenCliente(userId, [...propios, fila], hoy),
    reactivado,
    detalle: `Cobrado ${fila.monto}. Cubierto del ${fila.periodo_desde} al ${fila.periodo_hasta}.`
  });
});

/** Etiquetas para que el front no las invente por su cuenta. */
export const _metodos = METODOS;
