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
var users_exports = {};
__export(users_exports, {
  coincide: () => coincide,
  default: () => users_default,
  sinAcentos: () => sinAcentos,
  soloDigitos: () => soloDigitos
});
module.exports = __toCommonJS(users_exports);
var import_run = require("../_lib/run");
var import_http = require("../_lib/http");
var import_fechas = require("../_lib/fechas");
var import_auth = require("../_lib/auth");
var import_store = require("../_lib/store");
var import_mov = require("../_lib/mov.store");
var import_meta = require("../_lib/meta.store");
var import_pago = require("../_lib/pago.store");
var import_guard = require("../_lib/guard");
const nuevoId = () => "u_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const sinAcentos = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const soloDigitos = (s) => String(s ?? "").replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "");
function coincide(u, q) {
  const texto = sinAcentos(q);
  if (!texto) return true;
  const digitos = soloDigitos(q);
  const nombreCompleto = sinAcentos(`${u.nombre} ${u.ap_paterno} ${u.ap_materno}`);
  if (nombreCompleto.includes(texto)) return true;
  if (sinAcentos(u.correo).includes(texto)) return true;
  if (digitos.length >= 2) {
    const tel = soloDigitos(u.telefono);
    if (tel && (tel.includes(digitos) || tel.endsWith(digitos.slice(-10)))) return true;
  }
  const partes = texto.split(/\s+/).filter(Boolean);
  if (partes.length > 1) {
    return partes.every(
      (p) => nombreCompleto.includes(p) || sinAcentos(u.correo).includes(p) || soloDigitos(u.telefono).includes(soloDigitos(p))
    );
  }
  return false;
}
const publico = (u) => ({
  id: u.id,
  nombre: u.nombre,
  ap_paterno: u.ap_paterno,
  ap_materno: u.ap_materno,
  apellido: `${u.ap_paterno} ${u.ap_materno}`.replace(/\s+/g, " ").trim(),
  telefono: u.telefono,
  correo: u.correo,
  estatus: u.estatus,
  rol: u.rol,
  fecha_alta: u.fecha_alta,
  ultimo_acceso: u.ultimo_acceso || "\u2014",
  debeCambiarPass: Number(u.debe_cambiar_pass) === 1
});
const mes = (f) => (0, import_fechas.mesDe)(f);
const red2 = (n) => Math.round(n * 100) / 100;
function ultimosMeses(hoy, cuantos = 6) {
  const [y, m] = hoy.slice(0, 7).split("-").map(Number);
  const out = [];
  for (let i = cuantos - 1; i >= 0; i--) {
    const total = m - 1 - i;
    const y2 = y + Math.floor(total / 12);
    const m2 = (total % 12 + 12) % 12;
    out.push(`${y2}-${String(m2 + 1).padStart(2, "0")}`);
  }
  return out;
}
var users_default = (0, import_run.run)(async (req, res) => {
  if (!(0, import_http.metodoPermitido)(req, res, ["GET", "POST"])) return;
  await (0, import_guard.requireAdmin)(req);
  const store = (0, import_store.getStore)();
  if (req.method === "GET") {
    const detalle = String(req.query?.detalle || req.query?.id || "").trim();
    if (detalle) {
      const u = await store.findById(detalle);
      if (!u) throw new import_http.HttpError(404, "Usuario inexistente");
      const [movs, metas, pagos] = await Promise.all([
        (0, import_mov.getMovStore)().byUser(u.id),
        (0, import_meta.getMetaStore)().byUser(u.id),
        (0, import_pago.getPagoStore)().byUser(u.id)
      ]);
      const vivos = movs.filter((m) => Number(m.deleted) !== 1);
      const hoy = (0, import_http.hoyISO)();
      const conDatos = Array.from(new Set(vivos.map((m) => mes(m.fecha)).filter(Boolean))).sort();
      const ultimoConDatos = conDatos[conDatos.length - 1] || hoy.slice(0, 7);
      const ancla = ultimoConDatos > hoy.slice(0, 7) ? ultimoConDatos : hoy.slice(0, 7);
      const meses = ultimosMeses(ancla + "-01", 6);
      const serie = meses.map((ym) => {
        const del = vivos.filter((m) => mes(m.fecha) === ym);
        const ingresos = red2(del.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0));
        const egresos = red2(del.filter((m) => m.tipo === "egreso").reduce((s, m) => s + Number(m.monto), 0));
        return { ym, ingresos, egresos, balance: red2(ingresos - egresos), movimientos: del.length };
      });
      const delMes = vivos.filter((m) => mes(m.fecha) === hoy.slice(0, 7));
      const ingresosMes = red2(delMes.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0));
      const egresosMes = red2(delMes.filter((m) => m.tipo === "egreso").reduce((s, m) => s + Number(m.monto), 0));
      const mapa = /* @__PURE__ */ new Map();
      vivos.filter((m) => m.tipo === "egreso").forEach((m) => {
        const k = String(m.categoria || "Otro").trim() || "Otro";
        mapa.set(k, red2((mapa.get(k) || 0) + Number(m.monto)));
      });
      const porCategoria = [...mapa.entries()].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b2) => b2.monto - a.monto).slice(0, 8);
      const metasVivas = metas.filter((m) => Number(m.deleted) !== 1);
      const pagosVivos = pagos.filter((p) => Number(p.deleted) !== 1);
      (0, import_http.json)(res, 200, {
        ok: true,
        user: publico(u),
        hoy,
        totales: {
          ingresosMes,
          egresosMes,
          balanceMes: red2(ingresosMes - egresosMes),
          ingresosTotal: red2(vivos.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0)),
          egresosTotal: red2(vivos.filter((m) => m.tipo === "egreso").reduce((s, m) => s + Number(m.monto), 0)),
          movimientos: vivos.length,
          metas: metasVivas.length,
          metasObjetivo: red2(metasVivas.reduce((s, m) => s + Number(m.monto_objetivo), 0)),
          metasAhorrado: red2(metasVivas.reduce((s, m) => s + Number(m.monto_actual), 0)),
          pagos: pagosVivos.length,
          cobrado: red2(pagosVivos.reduce((s, p) => s + Number(p.monto), 0))
        },
        serie,
        mesAncla: ancla,
        fechasInvalidas: vivos.filter((m) => !(0, import_fechas.aFechaISO)(m.fecha)).length,
        porCategoria,
        movimientos: vivos.sort((a, b2) => String(b2.fecha).localeCompare(String(a.fecha))).slice(0, 80).map((m) => ({
          id: m.id,
          fecha: (0, import_fechas.aFechaISO)(m.fecha) || m.fecha,
          tipo: m.tipo,
          categoria: m.categoria,
          descripcion: m.descripcion,
          monto: Number(m.monto),
          metodo: m.metodo
        })),
        metas: metasVivas.map((m) => ({
          id: m.id,
          nombre: m.nombre,
          monto_objetivo: Number(m.monto_objetivo),
          monto_actual: Number(m.monto_actual),
          fecha_limite: m.fecha_limite,
          prioridad: m.prioridad
        })),
        pagos: pagosVivos.sort((a, b2) => String(b2.fecha_pago).localeCompare(String(a.fecha_pago))).map((p) => ({
          id: p.id,
          fecha_pago: p.fecha_pago,
          monto: Number(p.monto),
          metodo: p.metodo,
          meses: Number(p.meses),
          periodo_desde: p.periodo_desde,
          periodo_hasta: p.periodo_hasta
        }))
      });
      return;
    }
    const q = String(req.query?.q || "");
    const todas = await store.listUsers();
    const filas = q.trim() ? todas.filter((u) => coincide(u, q)) : todas;
    const visibles = filas.map(publico).sort((a, b2) => String(a.nombre).localeCompare(String(b2.nombre), "es"));
    (0, import_http.json)(res, 200, {
      ok: true,
      q: q || null,
      total: todas.length,
      encontrados: visibles.length,
      resumen: {
        activos: todas.filter((u) => u.estatus === "activo").length,
        desactivados: todas.filter((u) => u.estatus !== "activo").length,
        admins: todas.filter((u) => u.rol === "admin").length
      },
      users: visibles
    });
    return;
  }
  const b = (0, import_http.requireBody)(req);
  const nombre = String(b.nombre || "").trim();
  const ap_paterno = String(b.ap_paterno || "").trim();
  const ap_materno = String(b.ap_materno || "").trim();
  const telefono = String(b.telefono || "").replace(/[^\d]/g, "");
  const correo = String(b.correo || "").trim().toLowerCase();
  const rol = b.rol === "admin" ? "admin" : "user";
  if (!nombre) throw new import_http.HttpError(400, "Falta el nombre");
  if (!ap_paterno) throw new import_http.HttpError(400, "Falta el apellido paterno");
  if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(correo)) throw new import_http.HttpError(400, "Correo inv\xE1lido");
  if (telefono.length < 10) throw new import_http.HttpError(400, "El tel\xE9fono debe tener al menos 10 d\xEDgitos");
  const existente = await store.findByEmail(correo);
  if (existente) throw new import_http.HttpError(409, "Ya existe una cuenta con ese correo");
  const passwordManual = b.password ? String(b.password) : "";
  if (passwordManual) {
    const err = (0, import_auth.validarPasswordNueva)(passwordManual, correo);
    if (err) throw new import_http.HttpError(400, err);
  }
  const password = passwordManual || (0, import_auth.generarPasswordTemporal)();
  const fila = {
    id: nuevoId(),
    nombre,
    ap_paterno,
    ap_materno,
    telefono,
    correo,
    hash: (0, import_auth.hashPassword)(password),
    estatus: "activo",
    rol,
    fecha_alta: (0, import_http.hoyISO)(),
    ultimo_acceso: "",
    debe_cambiar_pass: 1,
    session_version: 1,
    intentos_fallidos: 0,
    bloqueado_hasta: ""
  };
  await store.insert(fila);
  (0, import_http.json)(res, 201, {
    ok: true,
    user: { id: fila.id, nombre, correo, rol, estatus: "activo" },
    passwordTemporal: passwordManual ? null : password,
    passwordElegida: passwordManual || null,
    aviso: "Guarda esta contrase\xF1a ahora: no se puede volver a mostrar. El usuario deber\xE1 cambiarla al entrar."
  });
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  coincide,
  sinAcentos,
  soloDigitos
});

if (module.exports && typeof module.exports.default === 'function') module.exports = module.exports.default;
