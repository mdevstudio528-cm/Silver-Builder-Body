"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.soloDigitos = exports.sinAcentos = void 0;
exports.coincide = coincide;
/**
 * GET /api/admin/users            → lista (con búsqueda por ?q=)
 * GET /api/admin/users?detalle=ID → ficha de UN usuario con sus movimientos,
 *                                   metas, pagos y las series para las gráficas
 * POST /api/admin/users           → alta (igual que antes)
 *
 * Todo pasa por requireAdmin: la búsqueda y la ficha no se pueden pedir como
 * cliente ni sin sesión, aunque alguien escriba la URL a mano.
 */
const run_1 = require("../_lib/run");
const http_1 = require("../_lib/http");
const auth_1 = require("../_lib/auth");
const store_1 = require("../_lib/store");
const mov_store_1 = require("../_lib/mov.store");
const meta_store_1 = require("../_lib/meta.store");
const pago_store_1 = require("../_lib/pago.store");
const guard_1 = require("../_lib/guard");
const nuevoId = () => 'u_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
/* ------------------------- búsqueda tolerante ------------------------- */
/** sin acentos, minúsculas: "ROSENDA" y "Rosénda" encuentran lo mismo */
const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
exports.sinAcentos = sinAcentos;
/** solo dígitos y sin el prefijo país: +52 771 353 5455 → 7713535455 */
const soloDigitos = (s) => String(s ?? '').replace(/\D/g, '').replace(/^52(?=\d{10}$)/, '');
exports.soloDigitos = soloDigitos;
/** ¿La fila coincide con el texto buscado (nombre, apellidos, correo o teléfono)? */
function coincide(u, q) {
    const texto = (0, exports.sinAcentos)(q);
    if (!texto)
        return true;
    const digitos = (0, exports.soloDigitos)(q);
    const nombreCompleto = (0, exports.sinAcentos)(`${u.nombre} ${u.ap_paterno} ${u.ap_materno}`);
    if (nombreCompleto.includes(texto))
        return true;
    if ((0, exports.sinAcentos)(u.correo).includes(texto))
        return true;
    // Si lo que escribió son puros dígitos (o casi), comparar contra el teléfono.
    if (digitos.length >= 2) {
        const tel = (0, exports.soloDigitos)(u.telefono);
        if (tel && (tel.includes(digitos) || tel.endsWith(digitos.slice(-10))))
            return true;
    }
    // "rosenda 771" → nombre Y teléfono en la misma caja
    const partes = texto.split(/\s+/).filter(Boolean);
    if (partes.length > 1) {
        return partes.every(p => nombreCompleto.includes(p) || (0, exports.sinAcentos)(u.correo).includes(p) || (0, exports.soloDigitos)(u.telefono).includes((0, exports.soloDigitos)(p)));
    }
    return false;
}
const publico = (u) => ({
    id: u.id,
    nombre: u.nombre,
    ap_paterno: u.ap_paterno,
    ap_materno: u.ap_materno,
    apellido: `${u.ap_paterno} ${u.ap_materno}`.replace(/\s+/g, ' ').trim(),
    telefono: u.telefono,
    correo: u.correo,
    estatus: u.estatus,
    rol: u.rol,
    fecha_alta: u.fecha_alta,
    ultimo_acceso: u.ultimo_acceso || '—',
    debeCambiarPass: Number(u.debe_cambiar_pass) === 1
});
const mes = (f) => String(f ?? '').slice(0, 7);
const red2 = (n) => Math.round(n * 100) / 100;
/** Últimos 6 meses naturales, terminando en el mes de hoy. */
function ultimosMeses(hoy, cuantos = 6) {
    const [y, m] = hoy.slice(0, 7).split('-').map(Number);
    const out = [];
    for (let i = cuantos - 1; i >= 0; i--) {
        const total = m - 1 - i;
        const y2 = y + Math.floor(total / 12);
        const m2 = ((total % 12) + 12) % 12;
        out.push(`${y2}-${String(m2 + 1).padStart(2, '0')}`);
    }
    return out;
}
exports.default = (0, run_1.run)(async (req, res) => {
    if (!(0, http_1.metodoPermitido)(req, res, ['GET', 'POST']))
        return;
    await (0, guard_1.requireAdmin)(req);
    const store = (0, store_1.getStore)();
    /* ---------------------------- LISTAR ---------------------------- */
    if (req.method === 'GET') {
        const detalle = String(req.query?.detalle || req.query?.id || '').trim();
        /* ---------- ficha de un usuario, con datos para graficar ---------- */
        if (detalle) {
            const u = await store.findById(detalle);
            if (!u)
                throw new http_1.HttpError(404, 'Usuario inexistente');
            const [movs, metas, pagos] = await Promise.all([
                (0, mov_store_1.getMovStore)().byUser(u.id),
                (0, meta_store_1.getMetaStore)().byUser(u.id),
                (0, pago_store_1.getPagoStore)().byUser(u.id)
            ]);
            const vivos = movs.filter(m => Number(m.deleted) !== 1);
            const hoy = (0, http_1.hoyISO)();
            const meses = ultimosMeses(hoy, 6);
            // serie mensual: ingresos, egresos y balance de los últimos 6 meses
            const serie = meses.map(ym => {
                const del = vivos.filter(m => mes(m.fecha) === ym);
                const ingresos = red2(del.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0));
                const egresos = red2(del.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0));
                return { ym, ingresos, egresos, balance: red2(ingresos - egresos), movimientos: del.length };
            });
            const delMes = vivos.filter(m => mes(m.fecha) === hoy.slice(0, 7));
            const ingresosMes = red2(delMes.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0));
            const egresosMes = red2(delMes.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0));
            // egresos por categoría (para la gráfica de barras horizontales)
            const mapa = new Map();
            vivos.filter(m => m.tipo === 'egreso').forEach(m => {
                const k = String(m.categoria || 'Otro').trim() || 'Otro';
                mapa.set(k, red2((mapa.get(k) || 0) + Number(m.monto)));
            });
            const porCategoria = [...mapa.entries()]
                .map(([categoria, monto]) => ({ categoria, monto }))
                .sort((a, b) => b.monto - a.monto)
                .slice(0, 8);
            const metasVivas = metas.filter(m => Number(m.deleted) !== 1);
            const pagosVivos = pagos.filter(p => Number(p.deleted) !== 1);
            (0, http_1.json)(res, 200, {
                ok: true,
                user: publico(u),
                hoy,
                totales: {
                    ingresosMes,
                    egresosMes,
                    balanceMes: red2(ingresosMes - egresosMes),
                    ingresosTotal: red2(vivos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0)),
                    egresosTotal: red2(vivos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0)),
                    movimientos: vivos.length,
                    metas: metasVivas.length,
                    metasObjetivo: red2(metasVivas.reduce((s, m) => s + Number(m.monto_objetivo), 0)),
                    metasAhorrado: red2(metasVivas.reduce((s, m) => s + Number(m.monto_actual), 0)),
                    pagos: pagosVivos.length,
                    cobrado: red2(pagosVivos.reduce((s, p) => s + Number(p.monto), 0))
                },
                serie,
                porCategoria,
                movimientos: vivos
                    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
                    .slice(0, 80)
                    .map(m => ({
                    id: m.id, fecha: m.fecha, tipo: m.tipo, categoria: m.categoria,
                    descripcion: m.descripcion, monto: Number(m.monto), metodo: m.metodo
                })),
                metas: metasVivas.map(m => ({
                    id: m.id, nombre: m.nombre, monto_objetivo: Number(m.monto_objetivo),
                    monto_actual: Number(m.monto_actual), fecha_limite: m.fecha_limite, prioridad: m.prioridad
                })),
                pagos: pagosVivos
                    .sort((a, b) => String(b.fecha_pago).localeCompare(String(a.fecha_pago)))
                    .map(p => ({
                    id: p.id, fecha_pago: p.fecha_pago, monto: Number(p.monto), metodo: p.metodo,
                    meses: Number(p.meses), periodo_desde: p.periodo_desde, periodo_hasta: p.periodo_hasta
                }))
            });
            return;
        }
        /* ------------------------ lista con búsqueda ------------------------ */
        const q = String(req.query?.q || '');
        const todas = await store.listUsers();
        const filas = q.trim() ? todas.filter(u => coincide(u, q)) : todas;
        const visibles = filas
            .map(publico)
            .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
        (0, http_1.json)(res, 200, {
            ok: true,
            q: q || null,
            total: todas.length,
            encontrados: visibles.length,
            resumen: {
                activos: todas.filter(u => u.estatus === 'activo').length,
                desactivados: todas.filter(u => u.estatus !== 'activo').length,
                admins: todas.filter(u => u.rol === 'admin').length
            },
            users: visibles
        });
        return;
    }
    /* ---------------------------- CREAR ----------------------------- */
    const b = (0, http_1.requireBody)(req);
    const nombre = String(b.nombre || '').trim();
    const ap_paterno = String(b.ap_paterno || '').trim();
    const ap_materno = String(b.ap_materno || '').trim();
    const telefono = String(b.telefono || '').replace(/[^\d]/g, '');
    const correo = String(b.correo || '').trim().toLowerCase();
    const rol = b.rol === 'admin' ? 'admin' : 'user';
    if (!nombre)
        throw new http_1.HttpError(400, 'Falta el nombre');
    if (!ap_paterno)
        throw new http_1.HttpError(400, 'Falta el apellido paterno');
    if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(correo))
        throw new http_1.HttpError(400, 'Correo inválido');
    if (telefono.length < 10)
        throw new http_1.HttpError(400, 'El teléfono debe tener al menos 10 dígitos');
    const existente = await store.findByEmail(correo);
    if (existente)
        throw new http_1.HttpError(409, 'Ya existe una cuenta con ese correo');
    const passwordManual = b.password ? String(b.password) : '';
    if (passwordManual) {
        const err = (0, auth_1.validarPasswordNueva)(passwordManual, correo);
        if (err)
            throw new http_1.HttpError(400, err);
    }
    const password = passwordManual || (0, auth_1.generarPasswordTemporal)();
    const fila = {
        id: nuevoId(),
        nombre,
        ap_paterno,
        ap_materno,
        telefono,
        correo,
        hash: (0, auth_1.hashPassword)(password),
        estatus: 'activo',
        rol,
        fecha_alta: (0, http_1.hoyISO)(),
        ultimo_acceso: '',
        debe_cambiar_pass: 1,
        session_version: 1,
        intentos_fallidos: 0,
        bloqueado_hasta: ''
    };
    await store.insert(fila);
    (0, http_1.json)(res, 201, {
        ok: true,
        user: { id: fila.id, nombre, correo, rol, estatus: 'activo' },
        passwordTemporal: passwordManual ? null : password,
        passwordElegida: passwordManual || null,
        aviso: 'Guarda esta contraseña ahora: no se puede volver a mostrar. El usuario deberá cambiarla al entrar.'
    });
});

if (module.exports && typeof module.exports.default === 'function') module.exports = module.exports.default;
