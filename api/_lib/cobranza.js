"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var cobranza_exports = {};
__export(cobranza_exports, {
  DIAS_AVISO: () => DIAS_AVISO,
  calcularPeriodo: () => calcularPeriodo,
  resumenCartera: () => resumenCartera,
  resumenCliente: () => resumenCliente,
  ultimoCobro: () => ultimoCobro
});
module.exports = __toCommonJS(cobranza_exports);
var import_fechas = require("./fechas");
const DIAS_AVISO = 7;
const activos = (pagos) => pagos.filter((p) => Number(p.deleted) !== 1);
function ultimoCobro(pagos) {
  const vivos = activos(pagos);
  if (!vivos.length) return null;
  return vivos.reduce((a, b) => String(b.periodo_hasta) > String(a.periodo_hasta) ? b : a);
}
function resumenCliente(userId, pagosDelUsuario, hoy) {
  const vivos = activos(pagosDelUsuario);
  const ultimo = ultimoCobro(vivos);
  const total = vivos.reduce((s, p) => s + Number(p.monto || 0), 0);
  if (!ultimo) {
    return {
      user_id: userId,
      estado: "sin_pago",
      cubierto_hasta: "",
      dias: null,
      mensualidad: 0,
      meses_pagados: 0,
      ultimo_pago: "",
      total_pagado: 0,
      pagos: 0
    };
  }
  const dias = (0, import_fechas.diasEntre)(hoy, ultimo.periodo_hasta);
  const estado = dias < 0 ? "vencido" : dias <= DIAS_AVISO ? "por_vencer" : "al_corriente";
  const meses = Math.max(1, Number(ultimo.meses) || 1);
  return {
    user_id: userId,
    estado,
    cubierto_hasta: ultimo.periodo_hasta,
    dias,
    mensualidad: Math.round(Number(ultimo.monto || 0) / meses * 100) / 100,
    meses_pagados: meses,
    ultimo_pago: ultimo.fecha_pago,
    total_pagado: Math.round(total * 100) / 100,
    pagos: vivos.length
  };
}
function calcularPeriodo(pagosDelUsuario, hoy, meses) {
  const ultimo = ultimoCobro(pagosDelUsuario);
  const desde = ultimo && String(ultimo.periodo_hasta) > hoy ? String(ultimo.periodo_hasta) : hoy;
  return { desde, hasta: sumarMesesLocal(desde, meses) };
}
function sumarMesesLocal(fecha, meses) {
  const [y, m, d] = fecha.split("-").map(Number);
  const total = m - 1 + Math.trunc(meses);
  const y2 = y + Math.floor(total / 12);
  const m2 = (total % 12 + 12) % 12;
  const ultimo = new Date(Date.UTC(y2, m2 + 1, 0)).getUTCDate();
  const d2 = Math.min(d, ultimo);
  return `${y2}-${String(m2 + 1).padStart(2, "0")}-${String(d2).padStart(2, "0")}`;
}
function resumenCartera(clientes, pagos, hoy) {
  const mes = hoy.slice(0, 7);
  const cobradoMes = pagos.filter((p) => Number(p.deleted) !== 1 && mesDe(p.fecha_pago) === mes).reduce((s, p) => s + Number(p.monto || 0), 0);
  const porEstado = (e) => clientes.filter((c) => c.estado === e).length;
  return {
    total: clientes.length,
    alCorriente: porEstado("al_corriente"),
    porVencer: porEstado("por_vencer"),
    vencidos: porEstado("vencido"),
    sinPago: porEstado("sin_pago"),
    cobradoMes: Math.round(cobradoMes * 100) / 100,
    /** Lo que deberías cobrar hoy: mensualidades de quienes están vencidos o sin pagar. */
    porCobrar: Math.round(clientes.filter((c) => c.estado === "vencido" || c.estado === "sin_pago").reduce((s, c) => s + c.mensualidad, 0) * 100) / 100,
    ingresoMensualRecurrente: Math.round(clientes.reduce((s, c) => s + c.mensualidad, 0) * 100) / 100
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DIAS_AVISO,
  calcularPeriodo,
  resumenCartera,
  resumenCliente,
  ultimoCobro
});
