/**
 * Todas las cuentas de dinero viven aquí, en el navegador. Funciones puras:
 * reciben filas y devuelven números. No tocan red ni base de datos.
 */
import type { LocalMov, Tipo } from './db';

export const CATEGORIAS: Record<Tipo, string[]> = {
  ingreso: ['Sueldo', 'Ventas', 'Freelance', 'Renta', 'Apoyo', 'Interés', 'Otro'],
  egreso: ['Comida', 'Transporte', 'Hogar', 'Servicios', 'Salud', 'Ocio', 'Ropa', 'Educación', 'Deudas', 'Otro']
};

export const METODOS = ['Efectivo', 'Transferencia', 'Tarjeta débito', 'Tarjeta crédito', 'Otro'];

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const mesDe = (fecha: string) => String(fecha || '').slice(0, 7);

export function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMes(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, (m - 1) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function etiquetaMes(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const txt = MESES[(m || 1) - 1] || '';
  return `${txt.charAt(0).toUpperCase()}${txt.slice(1)} ${y}`;
}

export function diaCorto(fecha: string): string {
  const [, m, d] = fecha.split('-');
  return `${Number(d)} ${MESES[Number(m) - 1]?.slice(0, 3) || ''}`;
}

export function money(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(Number(n) || 0);
}

export function moneyCorto(n: number): string {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return `$${v.toFixed(0)}`;
}

export const pct = (n: number, d = 0) => `${(Number(n) || 0).toFixed(d)}%`;

export interface Resumen {
  ym: string;
  ingresos: number;
  egresos: number;
  balance: number;
  movimientos: number;
  diasConRegistro: number;
  promedioEgresoDiario: number;
  tasaAhorro: number;
  porCategoria: { categoria: string; monto: number; porcentaje: number }[];
  mayorGasto: LocalMov | null;
}

const vivos = (rows: LocalMov[]) => rows.filter(r => Number(r.deleted) !== 1);

/** Totales del mes. `rows` puede traer todos los meses: aquí se filtra. */
export function resumen(rows: LocalMov[], ym: string): Resumen {
  const delMes = vivos(rows).filter(r => mesDe(r.fecha) === ym);
  const ingresos = delMes.filter(r => r.tipo === 'ingreso').reduce((a, r) => a + r.monto, 0);
  const egresos = delMes.filter(r => r.tipo === 'egreso').reduce((a, r) => a + r.monto, 0);
  const dias = new Set(delMes.map(r => r.fecha)).size;

  const bolsa = new Map<string, number>();
  delMes.filter(r => r.tipo === 'egreso').forEach(r => {
    const k = r.categoria || 'Otro';
    bolsa.set(k, (bolsa.get(k) || 0) + r.monto);
  });
  const porCategoria = [...bolsa.entries()]
    .map(([categoria, monto]) => ({ categoria, monto, porcentaje: egresos > 0 ? (monto / egresos) * 100 : 0 }))
    .sort((a, b) => b.monto - a.monto);

  const gastos = delMes.filter(r => r.tipo === 'egreso');
  const mayorGasto = gastos.length ? gastos.reduce((a, b) => (b.monto > a.monto ? b : a)) : null;

  return {
    ym, ingresos, egresos, balance: ingresos - egresos,
    movimientos: delMes.length, diasConRegistro: dias,
    promedioEgresoDiario: dias > 0 ? egresos / dias : 0,
    tasaAhorro: ingresos > 0 ? ((ingresos - egresos) / ingresos) * 100 : 0,
    porCategoria, mayorGasto
  };
}

export interface PuntoDia { dia: number; ingreso: number; egreso: number; acumulado: number; }

export function serieDiaria(rows: LocalMov[], ym: string): PuntoDia[] {
  const [y, m] = ym.split('-').map(Number);
  const total = new Date(y, m, 0).getDate();
  const dias: PuntoDia[] = Array.from({ length: total }, (_, i) => ({ dia: i + 1, ingreso: 0, egreso: 0, acumulado: 0 }));
  vivos(rows).filter(r => mesDe(r.fecha) === ym).forEach(r => {
    const d = Number(r.fecha.slice(8, 10));
    const p = dias[d - 1];
    if (!p) return;
    if (r.tipo === 'ingreso') p.ingreso += r.monto; else p.egreso += r.monto;
  });
  let acc = 0;
  dias.forEach(p => { acc += p.ingreso - p.egreso; p.acumulado = acc; });
  return dias;
}

/** Semáforo de salud del mes: 60 pts tasa de ahorro, 25 colchón, 15 constancia. */
export function salud(r: Resumen): { score: number; label: string; color: string } {
  const ahorro = Math.max(0, Math.min(60, (r.tasaAhorro / 30) * 60));
  const colchon = r.egresos > 0 ? Math.min(25, (r.balance / r.egresos) * 25) : (r.ingresos > 0 ? 25 : 0);
  const constancia = Math.min(15, (r.diasConRegistro / 20) * 15);
  const score = Math.round(Math.max(0, Math.min(100, ahorro + colchon + constancia)));
  if (score >= 80) return { score, label: 'Excelente', color: 'var(--ok)' };
  if (score >= 60) return { score, label: 'Saludable', color: 'var(--brand)' };
  if (score >= 40) return { score, label: 'En riesgo', color: 'var(--warn)' };
  return { score, label: 'Crítico', color: 'var(--bad)' };
}

/** Últimos movimientos, más recientes primero. */
export function recientes(rows: LocalMov[], n = 5): LocalMov[] {
  return vivos(rows)
    .slice()
    .sort((a, b) => (a.fecha === b.fecha ? String(b.created_at).localeCompare(String(a.created_at)) : b.fecha.localeCompare(a.fecha)))
    .slice(0, n);
}

export type { LocalMov };
