/**
 * GET /api/admin/cobranza
 *
 * Tablero de cobranza: quién está al corriente, quién está por vencer y quién
 * ya debe. Solo administradores. No devuelve el hash ni nada interno.
 */
import { run } from '../_lib/run';
import { json, metodoPermitido, hoyISO } from '../_lib/http';
import { getStore } from '../_lib/store';
import { getPagoStore } from '../_lib/pago.store';
import { requireAdmin } from '../_lib/guard';
import { resumenCliente, resumenCartera, type EstadoCobro } from '../_lib/cobranza';

/** Orden en pantalla: primero lo que duele. */
const PESO: Record<EstadoCobro, number> = { vencido: 0, sin_pago: 1, por_vencer: 2, al_corriente: 3 };

export default run(async (req, res) => {
  if (!metodoPermitido(req, res, ['GET'])) return;
  await requireAdmin(req);

  const hoy = hoyISO();
  const users = await getStore().listUsers();
  const pagos = await getPagoStore().listAll();

  // el admin no se cobra a sí mismo: solo se listan clientes (rol 'user')
  const clientes = users
    .filter(u => u.rol !== 'admin')
    .map(u => {
      const mios = pagos.filter(p => p.user_id === u.id);
      const r = resumenCliente(u.id, mios, hoy);
      return {
        ...r,
        nombre: `${u.nombre} ${u.ap_paterno} ${u.ap_materno}`.replace(/\s+/g, ' ').trim(),
        correo: u.correo,
        telefono: u.telefono,
        cuenta: u.estatus,
        historial: mios
          .filter(p => Number(p.deleted) !== 1)
          .sort((a, b) => String(b.fecha_pago).localeCompare(String(a.fecha_pago)))
          .slice(0, 12)
          .map(p => ({
            id: p.id,
            fecha_pago: p.fecha_pago,
            monto: Number(p.monto),
            metodo: p.metodo,
            meses: Number(p.meses),
            periodo_desde: p.periodo_desde,
            periodo_hasta: p.periodo_hasta,
            notas: p.notas
          }))
      };
    })
    .sort((a, b) => {
      const d = PESO[a.estado] - PESO[b.estado];
      if (d !== 0) return d;
      if (a.dias === null && b.dias === null) return a.nombre.localeCompare(b.nombre);
      if (a.dias === null) return 1;
      if (b.dias === null) return -1;
      return a.dias - b.dias;
    });

  const cartera = resumenCartera(clientes, pagos, hoy);

  json(res, 200, {
    ok: true,
    hoy,
    cartera,
    clientes,
    pagosRecientes: pagos
      .filter(p => Number(p.deleted) !== 1)
      .sort((a, b) => String(b.fecha_pago).localeCompare(String(a.fecha_pago)))
      .slice(0, 15)
      .map(p => {
        const u = users.find(x => x.id === p.user_id);
        return {
          id: p.id,
          cliente: u ? `${u.nombre} ${u.ap_paterno}`.trim() : '(usuario eliminado)',
          fecha_pago: p.fecha_pago,
          monto: Number(p.monto),
          metodo: p.metodo,
          meses: Number(p.meses),
          periodo_hasta: p.periodo_hasta
        };
      })
  });
});
