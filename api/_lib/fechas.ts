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


/** Cuántos días faltan para `fecha` desde `hoy` (negativo = ya pasó). */
export const diasRestantes = (hoy: string, fecha: string): number => diasEntre(hoy, fecha);

/**
 * Fechas que llegan de Google Sheets → siempre 'YYYY-MM-DD'.
 *
 * La MISMA fecha puede volver como:
 *   '2026-11-08'                 texto ISO (lo que escribe la app)
 *   '2026-11-08T06:00:00.000Z'   con hora
 *   '8/11/2026'                  formato de la hoja (d/m/aaaa)
 *   '11/8/2026'                  formato de la hoja (m/d/aaaa)
 *   46304                        número de serie de Sheets/Excel
 *   Date
 * Si no se puede leer, devuelve ''.
 *
 * FECHA_ORDEN=DMY (default, México) | MDY  → qué hacer cuando el día y el mes
 * son ambos <= 12 y por tanto la fecha es ambigua.
 */
const ORDEN = String(process.env.FECHA_ORDEN || 'DMY').toUpperCase();

const dos = (n: number) => String(n).padStart(2, '0');

function desdePartes(y: number, m: number, d: number): string {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return '';
  return `${y}-${dos(m)}-${dos(d)}`;
}

export function aFechaISO(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '';

  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return '';
    return desdePartes(valor.getUTCFullYear(), valor.getUTCMonth() + 1, valor.getUTCDate());
  }

  const txt = String(valor).trim();
  if (!txt) return '';

  // número de serie de Google Sheets (días desde 1899-12-30)
  if (/^\d+(\.\d+)?$/.test(txt)) {
    const serial = Number(txt);
    if (serial > 20000 && serial < 80000) {
      const f = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
      return desdePartes(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate());
    }
    return '';
  }

  // ISO: 2026-11-08 o 2026-11-08T...
  let m = txt.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m) return desdePartes(+m[1], +m[2], +m[3]);

  // dd/mm/aaaa o mm/dd/aaaa
  m = txt.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    let dia: number, mes: number;
    if (a > 12) { dia = a; mes = b; }
    else if (b > 12) { dia = b; mes = a; }
    else if (ORDEN === 'MDY') { mes = a; dia = b; }
    else { dia = a; mes = b; }
    return desdePartes(+m[3], mes, dia);
  }

  // dd/mm/aa
  m = txt.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    let dia: number, mes: number;
    if (a > 12) { dia = a; mes = b; }
    else if (b > 12) { dia = b; mes = a; }
    else if (ORDEN === 'MDY') { mes = a; dia = b; }
    else { dia = a; mes = b; }
    return desdePartes(2000 + (+m[3]), mes, dia);
  }

  const d = new Date(txt);
  if (!isNaN(d.getTime())) {
    return desdePartes(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return '';
}

/** 'YYYY-MM' del mes al que pertenece la fecha ('' si no se pudo leer). */
export function mesDe(valor: unknown): string {
  const f = aFechaISO(valor);
  return f ? f.slice(0, 7) : '';
}
