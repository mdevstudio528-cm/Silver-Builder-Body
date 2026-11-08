/**
 * Formato de miles para dinero. Los montos se muestran y se escriben con coma
 * de millar (10,000) pero SIEMPRE se guardan como número limpio (10000).
 *
 * Reglas:
 *   - formatearMiles(10000)      → '10,000'
 *   - formatearMiles(12500.5)    → '12,500.50'
 *   - aNumero('10,000')          → 10000
 *   - aNumero('12,500.50')       → 12500.5
 *   - aNumero('') / basura       → null
 */
export function formatearMiles(valor: number | string | null | undefined): string {
  const n = typeof valor === 'number' ? valor : aNumero(valor);
  if (n === null) return '';

  const neg = n < 0;
  const abs = Math.abs(n);
  const tieneCentavos = Math.round(abs * 100) % 100 !== 0;
  const entero = Math.floor(abs);
  const centavos = Math.round((abs - entero) * 100);

  const enteroTxt = String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cuerpo = centavos > 0
    ? `${enteroTxt}.${String(centavos).padStart(2, '0')}`
    : (Number.isInteger(abs) ? enteroTxt : `${enteroTxt}.${String(centavos).padStart(2, '0')}`);

  return (n < 0 ? '-' : '') + cuerpo;
}

/** Convierte lo que haya escrito la persona a número. Nunca devuelve NaN. */
export function aNumero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return isFinite(valor) ? valor : null;

  // quita comas de millar, espacios, signo de pesos y cualquier letra
  let txt = String(valor).trim().replace(/[,\s$]/g, '').replace(/[^\d.-]/g, '');
  if (!txt || txt === '-' || txt === '.' || txt === '-.') return null;

  // si quedaron varios puntos, solo vale el primero (10.50.30 → 10.5030 no, se descarta)
  const partes = txt.split('.');
  if (partes.length > 2) txt = partes[0] + '.' + partes.slice(1).join('');

  const n = Number(txt);
  return isFinite(n) ? n : null;
}

/** Solo dígitos y un punto: se usa mientras se escribe para no romper el campo. */
export function limpiarMientrasEscribe(texto: string): string {
  let t = String(texto).replace(/,/g, '').replace(/[^\d.]/g, '');
  const i = t.indexOf('.');
  if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '');
  return t;
}
