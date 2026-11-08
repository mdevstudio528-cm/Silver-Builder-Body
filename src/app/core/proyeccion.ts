/**
 * Matemática de las metas: cuánto falta, a qué ritmo vas y si llegas a tiempo.
 * Todo se calcula con TU ritmo real de ahorro (promedio de los últimos meses),
 * no con un número inventado.
 */
import type { LocalMeta, LocalMov } from './db';
import { mesActual, mesDe, shiftMes } from './finance';

export interface MesAhorro { ym: string; ingresos: number; egresos: number; ahorro: number; }

export interface Ritmo {
  promedio: number;        // ahorro mensual promedio (puede ser 0 o negativo)
  meses: MesAhorro[];      // solo los meses con movimientos
  mesesConDatos: number;
  mejorMes: number;
  mesesVentana: number;
}

/** Ahorro real (ingresos − egresos) de los últimos `n` meses, contando el actual. */
export function ritmoAhorro(rows: LocalMov[], n = 3): Ritmo {
  const vivos = rows.filter(r => Number(r.deleted) !== 1);
  const meses: MesAhorro[] = [];
  const hoy = mesActual();

  for (let i = n - 1; i >= 0; i--) {
    const ym = shiftMes(hoy, -i);
    const delMes = vivos.filter(r => mesDe(r.fecha) === ym);
    if (delMes.length === 0) continue;
    const ingresos = delMes.filter(r => r.tipo === 'ingreso').reduce((a, r) => a + r.monto, 0);
    const egresos = delMes.filter(r => r.tipo === 'egreso').reduce((a, r) => a + r.monto, 0);
    meses.push({ ym, ingresos, egresos, ahorro: ingresos - egresos });
  }

  const mesesConDatos = meses.length;
  const promedio = mesesConDatos ? meses.reduce((a, m) => a + m.ahorro, 0) / mesesConDatos : 0;
  const mejorMes = mesesConDatos ? Math.max(...meses.map(m => m.ahorro)) : 0;
  return { promedio, meses, mesesConDatos, mejorMes, mesesVentana: n };
}

/** Suma meses a una fecha YYYY-MM-DD respetando el fin de mes (31 ene + 1 → 28/29 feb). */
export function sumarMeses(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const ultimoDia = new Date(y, m - 1 + n + 1, 0).getDate();
  const fecha2 = new Date(y, m - 1 + n, Math.min(d || 1, ultimoDia));
  const p = (x: number) => String(x).padStart(2, '0');
  return `${fecha2.getFullYear()}-${p(fecha2.getMonth() + 1)}-${p(fecha2.getDate())}`;
}

/** Meses completos entre dos fechas (si la de fin es anterior, devuelve negativo). */
export function mesesEntre(desde: string, hasta: string): number {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  let meses = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) meses -= 1;
  return meses;
}

export type EstadoMeta = 'lograda' | 'en-camino' | 'atrasada' | 'vencida' | 'sin-ritmo';

export interface Proyeccion {
  progreso: number;              // 0..100
  faltante: number;
  mesesRestantes: number;        // hasta la fecha límite
  aporteRequerido: number;       // por mes para cumplir en la fecha límite
  mesesNecesarios: number | null;// al ritmo real actual
  fechaEstimada: string | null;  // cuándo llegarías a ese ritmo
  estado: EstadoMeta;
  etiqueta: string;
  color: string;
  diasRestantes: number;
}

export const ESTADO_INFO: Record<EstadoMeta, { etiqueta: string; color: string }> = {
  lograda:   { etiqueta: 'Meta lograda',        color: 'var(--ok)' },
  'en-camino': { etiqueta: 'Vas en camino',     color: 'var(--brand)' },
  atrasada:  { etiqueta: 'Necesita más ahorro', color: 'var(--warn)' },
  vencida:   { etiqueta: 'Fecha vencida',       color: 'var(--bad)' },
  'sin-ritmo': { etiqueta: 'Sin historial aún', color: 'var(--muted)' }
};

/**
 * Proyección de una meta.
 * @param ritmo promedio mensual de ahorro real (de ritmoAhorro)
 * @param hoy   fecha de hoy YYYY-MM-DD (hora local del usuario)
 */
export function proyectar(meta: LocalMeta, ritmo: number, hoy: string): Proyeccion {
  const objetivo = Number(meta.monto_objetivo) || 0;
  const actual = Number(meta.monto_actual) || 0;
  const faltante = Math.max(0, objetivo - actual);
  const progreso = objetivo > 0 ? Math.min(100, (actual / objetivo) * 100) : 0;

  const mesesRestantes = Math.max(0, mesesEntre(hoy, meta.fecha_limite));
  const diasRestantes = Math.round(
    (new Date(meta.fecha_limite + 'T12:00:00').getTime() - new Date(hoy + 'T12:00:00').getTime()) / 86_400_000
  );
  const aporteRequerido = faltante <= 0 ? 0 : (mesesRestantes > 0 ? faltante / mesesRestantes : faltante);

  let mesesNecesarios: number | null = null;
  let fechaEstimada: string | null = null;

  if (faltante <= 0) {
    return {
      progreso: 100, faltante: 0, mesesRestantes, aporteRequerido: 0,
      mesesNecesarios: 0, fechaEstimada: meta.fecha_limite,
      estado: 'lograda', etiqueta: ESTADO_INFO.lograda.etiqueta, color: ESTADO_INFO.lograda.color,
      diasRestantes
    };
  }

  if (ritmo > 0) {
    mesesNecesarios = Math.ceil(faltante / ritmo);
    fechaEstimada = sumarMeses(hoy, mesesNecesarios);
  }

  let estado: EstadoMeta;
  if (diasRestantes < 0) estado = 'vencida';
  else if (ritmo <= 0) estado = 'sin-ritmo';
  else estado = (fechaEstimada as string) <= meta.fecha_limite ? 'en-camino' : 'atrasada';

  return {
    progreso, faltante, mesesRestantes, aporteRequerido,
    mesesNecesarios, fechaEstimada, estado,
    etiqueta: ESTADO_INFO[estado].etiqueta, color: ESTADO_INFO[estado].color,
    diasRestantes
  };
}

export interface ResumenMetas {
  metas: number;
  objetivoTotal: number;
  ahorradoTotal: number;
  faltanteTotal: number;
  progresoGlobal: number;
  aporteMensualTotal: number;
  enRiesgo: number;
  logradas: number;
}

export function resumenMetas(metas: LocalMeta[], ritmo: number, hoy: string): ResumenMetas {
  const vivas = metas.filter(m => Number(m.deleted) !== 1);
  const proys = vivas.map(m => proyectar(m, ritmo, hoy));
  const objetivoTotal = vivas.reduce((a, m) => a + (Number(m.monto_objetivo) || 0), 0);
  const ahorradoTotal = vivas.reduce((a, m) => a + (Number(m.monto_actual) || 0), 0);
  const faltanteTotal = Math.max(0, objetivoTotal - ahorradoTotal);
  return {
    metas: vivas.length,
    objetivoTotal,
    ahorradoTotal,
    faltanteTotal,
    progresoGlobal: objetivoTotal > 0 ? Math.min(100, (ahorradoTotal / objetivoTotal) * 100) : 0,
    aporteMensualTotal: proys.reduce((a, p) => a + p.aporteRequerido, 0),
    enRiesgo: proys.filter(p => p.estado === 'atrasada' || p.estado === 'vencida').length,
    logradas: proys.filter(p => p.estado === 'lograda').length
  };
}

export const fechaBonita = (iso: string): string => {
  if (!iso || iso.length < 10) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const nombres = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${nombres[(m || 1) - 1]} ${y}`;
};
