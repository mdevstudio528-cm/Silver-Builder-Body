"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * GET /api/admin/cobranza
 *
 * Tablero de cobranza: quién está al corriente, quién está por vencer y quién
 * ya debe. Solo administradores. No devuelve el hash ni nada interno.
 */
const run_1 = require("../_lib/run");
const http_1 = require("../_lib/http");
const store_1 = require("../_lib/store");
const pago_store_1 = require("../_lib/pago.store");
const guard_1 = require("../_lib/guard");
const cobranza_1 = require("../_lib/cobranza");
/** Orden en pantalla: primero lo que duele. */
const PESO = { vencido: 0, sin_pago: 1, por_vencer: 2, al_corriente: 3 };
exports.default = (0, run_1.run)(async (req, res) => {
    if (!(0, http_1.metodoPermitido)(req, res, ['GET']))
        return;
    await (0, guard_1.requireAdmin)(req);
    const hoy = (0, http_1.hoyISO)();
    const users = await (0, store_1.getStore)().listUsers();
    const pagos = await (0, pago_store_1.getPagoStore)().listAll();
    // el admin no se cobra a sí mismo: solo se listan clientes (rol 'user')
    const clientes = users
        .filter(u => u.rol !== 'admin')
        .map(u => {
        const mios = pagos.filter(p => p.user_id === u.id);
        const r = (0, cobranza_1.resumenCliente)(u.id, mios, hoy);
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
        if (d !== 0)
            return d;
        if (a.dias === null && b.dias === null)
            return a.nombre.localeCompare(b.nombre);
        if (a.dias === null)
            return 1;
        if (b.dias === null)
            return -1;
        return a.dias - b.dias;
    });
    const cartera = (0, cobranza_1.resumenCartera)(clientes, pagos, hoy);
    (0, http_1.json)(res, 200, {
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

/* Vercel / Node: el runtime invoca module.exports directamente, no .default */
if (module.exports && typeof module.exports.default === 'function') module.exports = module.exports.default;
