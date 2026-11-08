/**
 * Aritmética de fechas en texto 'YYYY-MM-DD', sin dependencias y sin zonas
 * horarias: se trabaja siempre en UTC para que un día nunca se corra.
 *
 * Se usa en la cobranza para saber hasta cuándo está cubierto un cliente.
 */

/** Valida el formato y que la fecha exista de verdad (2026-02-30 no existe). */
export function fechaValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const [y, m, d] = String(s).split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const f = new Date(t);
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

const ultimoDiaDelMes = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * Suma meses a una fecha. Si el día no existe en el mes destino, se recorta al
 * último día: 2026-01-31 + 1 mes = 2026-02-28, 2028-01-31 + 1 mes = 2028-02-29.
 */
export function sumarMeses(fecha: string, meses: number): string {
  const [y, m, d] = String(fecha).split('-').map(Number);
  const total = m - 1 + Math.trunc(meses);
  const y2 = y + Math.floor(total / 12);
  const m2 = ((total % 12) + 12) % 12;
  const d2 = Math.min(d, ultimoDiaDelMes(y2, m2 + 1));
  return `${y2}-${String(m2 + 1).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
}

/** Días de `desde` a `hasta`. Positivo si `hasta` es futuro. */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (!isFinite(a) || !isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** '2026-11' para agrupar por mes. */
export const mesDe = (fecha: string): string => String(fecha).slice(0, 7);

/** Cuántos días faltan para `fecha` desde `hoy` (negativo = ya pasó). */
export const diasRestantes = (hoy: string, fecha: string): number => diasEntre(hoy, fecha);
