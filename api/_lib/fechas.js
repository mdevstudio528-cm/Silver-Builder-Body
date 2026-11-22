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
var fechas_exports = {};
__export(fechas_exports, {
  aFechaISO: () => aFechaISO,
  diasEntre: () => diasEntre,
  diasRestantes: () => diasRestantes,
  fechaValida: () => fechaValida,
  mesDe: () => mesDe,
  sumarMeses: () => sumarMeses
});
module.exports = __toCommonJS(fechas_exports);
function fechaValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const [y, m, d] = String(s).split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const f = new Date(t);
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}
const ultimoDiaDelMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function sumarMeses(fecha, meses) {
  const [y, m, d] = String(fecha).split("-").map(Number);
  const total = m - 1 + Math.trunc(meses);
  const y2 = y + Math.floor(total / 12);
  const m2 = (total % 12 + 12) % 12;
  const d2 = Math.min(d, ultimoDiaDelMes(y2, m2 + 1));
  return `${y2}-${String(m2 + 1).padStart(2, "0")}-${String(d2).padStart(2, "0")}`;
}
function diasEntre(desde, hasta) {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (!isFinite(a) || !isFinite(b)) return 0;
  return Math.round((b - a) / 864e5);
}
const diasRestantes = (hoy, fecha) => diasEntre(hoy, fecha);
const ORDEN = String(process.env.FECHA_ORDEN || "DMY").toUpperCase();
const dos = (n) => String(n).padStart(2, "0");
function desdePartes(y, m, d) {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return "";
  return `${y}-${dos(m)}-${dos(d)}`;
}
function aFechaISO(valor) {
  if (valor === null || valor === void 0 || valor === "") return "";
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return "";
    return desdePartes(valor.getUTCFullYear(), valor.getUTCMonth() + 1, valor.getUTCDate());
  }
  const txt = String(valor).trim();
  if (!txt) return "";
  if (/^\d+(\.\d+)?$/.test(txt)) {
    const serial = Number(txt);
    if (serial > 2e4 && serial < 8e4) {
      const f = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 864e5);
      return desdePartes(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate());
    }
    return "";
  }
  let m = txt.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m) return desdePartes(+m[1], +m[2], +m[3]);
  m = txt.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    let dia, mes;
    if (a > 12) {
      dia = a;
      mes = b;
    } else if (b > 12) {
      dia = b;
      mes = a;
    } else if (ORDEN === "MDY") {
      mes = a;
      dia = b;
    } else {
      dia = a;
      mes = b;
    }
    return desdePartes(+m[3], mes, dia);
  }
  m = txt.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    let dia, mes;
    if (a > 12) {
      dia = a;
      mes = b;
    } else if (b > 12) {
      dia = b;
      mes = a;
    } else if (ORDEN === "MDY") {
      mes = a;
      dia = b;
    } else {
      dia = a;
      mes = b;
    }
    return desdePartes(2e3 + +m[3], mes, dia);
  }
  const d = new Date(txt);
  if (!isNaN(d.getTime())) {
    return desdePartes(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return "";
}
function mesDe(valor) {
  const f = aFechaISO(valor);
  return f ? f.slice(0, 7) : "";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  aFechaISO,
  diasEntre,
  diasRestantes,
  fechaValida,
  mesDe,
  sumarMeses
});
