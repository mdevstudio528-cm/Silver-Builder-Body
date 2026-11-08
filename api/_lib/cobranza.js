"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIAS_AVISO = void 0;
exports.ultimoCobro = ultimoCobro;
exports.resumenCliente = resumenCliente;
exports.calcularPeriodo = calcularPeriodo;
exports.resumenCartera = resumenCartera;
const fechas_1 = require("./fechas");
/** Días de aviso antes del corte en los que se pinta ámbar. */
exports.DIAS_AVISO = 7;
const activos = (pagos) => pagos.filter(p => Number(p.deleted) !== 1);
/** El pago que cubre más lejos en el tiempo (no el último registrado). */
function ultimoCobro(pagos) {
    const vivos = activos(pagos);
    if (!vivos.length)
        return null;
    return vivos.reduce((a, b) => (String(b.periodo_hasta) > String(a.periodo_hasta) ? b : a));
}
function resumenCliente(userId, pagosDelUsuario, hoy) {
    const vivos = activos(pagosDelUsuario);
    const ultimo = ultimoCobro(vivos);
    const total = vivos.reduce((s, p) => s + Number(p.monto || 0), 0);
    if (!ultimo) {
        return {
            user_id: userId,
            estado: 'sin_pago',
            cubierto_hasta: '',
            dias: null,
            mensualidad: 0,
            meses_pagados: 0,
            ultimo_pago: '',
            total_pagado: 0,
            pagos: 0
        };
    }
    const dias = (0, fechas_1.diasEntre)(hoy, ultimo.periodo_hasta);
    const estado = dias < 0 ? 'vencido' : dias <= exports.DIAS_AVISO ? 'por_vencer' : 'al_corriente';
    const meses = Math.max(1, Number(ultimo.meses) || 1);
    return {
        user_id: userId,
        estado,
        cubierto_hasta: ultimo.periodo_hasta,
        dias,
        mensualidad: Math.round((Number(ultimo.monto || 0) / meses) * 100) / 100,
        meses_pagados: meses,
        ultimo_pago: ultimo.fecha_pago,
        total_pagado: Math.round(total * 100) / 100,
        pagos: vivos.length
    };
}
/**
 * Calcula el periodo que cubre un cobro nuevo.
 *   - si sigue cubierto: arranca donde termina lo pagado (no se regala tiempo)
 *   - si está vencido o nunca pagó: arranca hoy (no se cobra el tiempo perdido)
 */
function calcularPeriodo(pagosDelUsuario, hoy, meses) {
    const ultimo = ultimoCobro(pagosDelUsuario);
    const desde = ultimo && String(ultimo.periodo_hasta) > hoy ? String(ultimo.periodo_hasta) : hoy;
    return { desde, hasta: sumarMesesLocal(desde, meses) };
}
/* copia local mínima para no crear dependencia circular al importar fechas */
function sumarMesesLocal(fecha, meses) {
    const [y, m, d] = fecha.split('-').map(Number);
    const total = m - 1 + Math.trunc(meses);
    const y2 = y + Math.floor(total / 12);
    const m2 = ((total % 12) + 12) % 12;
    const ultimo = new Date(Date.UTC(y2, m2 + 1, 0)).getUTCDate();
    const d2 = Math.min(d, ultimo);
    return `${y2}-${String(m2 + 1).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
}
/** Totales del tablero. */
function resumenCartera(clientes, pagos, hoy) {
    const mes = hoy.slice(0, 7);
    const cobradoMes = pagos
        .filter(p => Number(p.deleted) !== 1 && String(p.fecha_pago).slice(0, 7) === mes)
        .reduce((s, p) => s + Number(p.monto || 0), 0);
    const porEstado = (e) => clientes.filter(c => c.estado === e).length;
    return {
        total: clientes.length,
        alCorriente: porEstado('al_corriente'),
        porVencer: porEstado('por_vencer'),
        vencidos: porEstado('vencido'),
        sinPago: porEstado('sin_pago'),
        cobradoMes: Math.round(cobradoMes * 100) / 100,
        /** Lo que deberías cobrar hoy: mensualidades de quienes están vencidos o sin pagar. */
        porCobrar: Math.round(clientes.filter(c => c.estado === 'vencido' || c.estado === 'sin_pago').reduce((s, c) => s + c.mensualidad, 0) * 100) / 100,
        ingresoMensualRecurrente: Math.round(clientes.reduce((s, c) => s + c.mensualidad, 0) * 100) / 100
    };
}
