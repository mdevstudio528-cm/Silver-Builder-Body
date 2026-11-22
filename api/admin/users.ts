/**
 * GET /api/admin/users            → lista (con búsqueda por ?q=)
 * GET /api/admin/users?detalle=ID → ficha de UN usuario con sus movimientos,
 *                                   metas, pagos y las series para las gráficas
 * POST /api/admin/users           → alta (igual que antes)
 *
 * Todo pasa por requireAdmin: la búsqueda y la ficha no se pueden pedir como
 * cliente ni sin sesión, aunque alguien escriba la URL a mano.
 */
import { run } from '../_lib/run';
import { HttpError, json, requireBody, metodoPermitido, hoyISO } from '../_lib/http';
import { aFechaISO, mesDe } from '../_lib/fechas';
import { hashPassword, generarPasswordTemporal, validarPasswordNueva } from '../_lib/auth';
import { getStore } from '../_lib/store';
import { getMovStore } from '../_lib/mov.store';
import { getMetaStore } from '../_lib/meta.store';
import { getPagoStore } from '../_lib/pago.store';
import { requireAdmin } from '../_lib/guard';
import type { UserRow } from '../_lib/users.types';

const nuevoId = () => 'u_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

/* ------------------------- búsqueda tolerante ------------------------- */
/** sin acentos, minúsculas: "ROSENDA" y "Rosénda" encuentran lo mismo */
export const sinAcentos = (s: any) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** solo dígitos y sin el prefijo país: +52 771 353 5455 → 7713535455 */
export const soloDigitos = (s: any) => String(s ?? '').replace(/\D/g, '').replace(/^52(?=\d{10}$)/, '');

/** ¿La fila coincide con el texto buscado (nombre, apellidos, correo o teléfono)? */
export function coincide(u: UserRow, q: string): boolean {
  const texto = sinAcentos(q);
  if (!texto) return true;
  const digitos = soloDigitos(q);

  const nombreCompleto = sinAcentos(`${u.nombre} ${u.ap_paterno} ${u.ap_materno}`);
  if (nombreCompleto.includes(texto)) return true;
  if (sinAcentos(u.correo).includes(texto)) return true;

  // Si lo que escribió son puros dígitos (o casi), comparar contra el teléfono.
  if (digitos.length >= 2) {
    const tel = soloDigitos(u.telefono);
    if (tel && (tel.includes(digitos) || tel.endsWith(digitos.slice(-10)))) return true;
  }
  // "rosenda 771" → nombre Y teléfono en la misma caja
  const partes = texto.split(/\s+/).filter(Boolean);
  if (partes.length > 1) {
    return partes.every(p =>
      nombreCompleto.includes(p) || sinAcentos(u.correo).includes(p) || soloDigitos(u.telefono).includes(soloDigitos(p))
    );
  }
  return false;
}

const publico = (u: UserRow) => ({
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

// OJO: en la hoja la fecha puede volver como '8/11/2026' o como número de
// serie. Con slice(0,7) eso daba '8/11/20' y el mes nunca coincidía: por eso
// las gráficas salían vacías y el mes en $0.00 aunque hubiera movimientos.
const mes = (f: any) => mesDe(f);
const red2 = (n: number) => Math.round(n * 100) / 100;

/** Últimos 6 meses naturales, terminando en el mes de hoy. */
function ultimosMeses(hoy: string, cuantos = 6): string[] {
  const [y, m] = hoy.slice(0, 7).split('-').map(Number);
  const out: string[] = [];
  for (let i = cuantos - 1; i >= 0; i--) {
    const total = m - 1 - i;
    const y2 = y + Math.floor(total / 12);
    const m2 = ((total % 12) + 12) % 12;
    out.push(`${y2}-${String(m2 + 1).padStart(2, '0')}`);
  }
  return out;
}

export default run(async (req, res) => {
  if (!metodoPermitido(req, res, ['GET', 'POST'])) return;
  await requireAdmin(req);

  const store = getStore();

  /* ---------------------------- LISTAR ---------------------------- */
  if (req.method === 'GET') {
    const detalle = String(req.query?.detalle || req.query?.id || '').trim();

    /* ---------- ficha de un usuario, con datos para graficar ---------- */
    if (detalle) {
      const u = await store.findById(detalle);
      if (!u) throw new HttpError(404, 'Usuario inexistente');

      const [movs, metas, pagos] = await Promise.all([
        getMovStore().byUser(u.id),
        getMetaStore().byUser(u.id),
        getPagoStore().byUser(u.id)
      ]);

      const vivos = movs.filter(m => Number(m.deleted) !== 1);
      const hoy = hoyISO();
      // Ventana de 6 meses anclada al mes más reciente con datos: si el usuario
      // solo tiene movimientos viejos, la gráfica ya no aparece en blanco.
      const conDatos = Array.from(new Set(vivos.map(m => mes(m.fecha)).filter(Boolean))).sort();
      const ultimoConDatos = conDatos[conDatos.length - 1] || hoy.slice(0, 7);
      const ancla = ultimoConDatos > hoy.slice(0, 7) ? ultimoConDatos : hoy.slice(0, 7);
      const meses = ultimosMeses(ancla + '-01', 6);

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
      const mapa = new Map<string, number>();
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

      json(res, 200, {
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
        mesAncla: ancla,
        fechasInvalidas: vivos.filter(m => !aFechaISO(m.fecha)).length,
        porCategoria,
        movimientos: vivos
          .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
          .slice(0, 80)
          .map(m => ({
            id: m.id, fecha: aFechaISO(m.fecha) || m.fecha, tipo: m.tipo, categoria: m.categoria,
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

    json(res, 200, {
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
  const b = requireBody(req);
  const nombre = String(b.nombre || '').trim();
  const ap_paterno = String(b.ap_paterno || '').trim();
  const ap_materno = String(b.ap_materno || '').trim();
  const telefono = String(b.telefono || '').replace(/[^\d]/g, '');
  const correo = String(b.correo || '').trim().toLowerCase();
  const rol = b.rol === 'admin' ? 'admin' : 'user';

  if (!nombre) throw new HttpError(400, 'Falta el nombre');
  if (!ap_paterno) throw new HttpError(400, 'Falta el apellido paterno');
  if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(correo)) throw new HttpError(400, 'Correo inválido');
  if (telefono.length < 10) throw new HttpError(400, 'El teléfono debe tener al menos 10 dígitos');

  const existente = await store.findByEmail(correo);
  if (existente) throw new HttpError(409, 'Ya existe una cuenta con ese correo');

  const passwordManual = b.password ? String(b.password) : '';
  if (passwordManual) {
    const err = validarPasswordNueva(passwordManual, correo);
    if (err) throw new HttpError(400, err);
  }
  const password = passwordManual || generarPasswordTemporal();

  const fila: UserRow = {
    id: nuevoId(),
    nombre,
    ap_paterno,
    ap_materno,
    telefono,
    correo,
    hash: hashPassword(password),
    estatus: 'activo',
    rol,
    fecha_alta: hoyISO(),
    ultimo_acceso: '',
    debe_cambiar_pass: 1,
    session_version: 1,
    intentos_fallidos: 0,
    bloqueado_hasta: ''
  };

  await store.insert(fila);

  json(res, 201, {
    ok: true,
    user: { id: fila.id, nombre, correo, rol, estatus: 'activo' },
    passwordTemporal: passwordManual ? null : password,
    passwordElegida: passwordManual || null,
    aviso: 'Guarda esta contraseña ahora: no se puede volver a mostrar. El usuario deberá cambiarla al entrar.'
  });
});
