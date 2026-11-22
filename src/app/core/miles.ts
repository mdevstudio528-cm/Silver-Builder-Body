/**
 * Dinero con coma de millar y decimales.
 *
 * Regla de la casa (México): la COMA separa miles, el PUNTO separa decimales.
 *   formatearMiles(20000)         → '20,000'
 *   formatearMiles(1234.5)        → '1,234.50'
 *   formatearMilesParcial('2000') → '2,000'   (lo que se ve MIENTRAS escribe)
 *   aNumero('20,000')             → 20000     (number)
 *   aNumero('1234,5')             → 1234.5    (coma decimal del teclado ES)
 *   aNumero('') / basura          → null
 *
 * El modelo SIEMPRE recibe un number; el texto con comas es solo para la vista.
 */

/**
 * Deja el texto como "digitos" + opcional "." + hasta 2 decimales.
 *
 *   '20,000'      → '20000'
 *   '1,234,567'   → '1234567'
 *   '1234.5'      → '1234.5'
 *   '1234,5'      → '1234.5'   (teclado en español)
 *   '1234,'       → '1234.'    (coma decimal a medio escribir: NO se borra)
 *   '1,234,5'     → '1234.5'   (miles + coma decimal)
 *   '$ 20,000.00' → '20000.00'
 *   '1234.'       → '1234.'    (mientras escribe, se conserva)
 *   'abc' / ''    → ''
 */
export function soloNumerico(texto: string | number | null | undefined): string {
  if (texto === null || texto === undefined) return '';
  const t = String(texto).replace(/[^\d.,]/g, '');
  if (!t || !/\d/.test(t)) return '';

  const tieneComa = t.includes(',');
  const tienePunto = t.includes('.');

  let dec = -1; // posición del separador decimal, -1 = no hay

  if (tieneComa && tienePunto) {
    // "1,234.56" / "1.234,56" → el último símbolo que aparece manda
    dec = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  } else if (tieneComa) {
    const partes = t.split(',');
    const ult = partes[partes.length - 1];

    if (partes.length > 2) {
      // "1,234,5" → la última es decimal; "1,234,567" → todas de miles
      dec = ult.length >= 1 && ult.length <= 2 ? t.lastIndexOf(',') : -1;
    } else {
      // dos partes: "1,5" y "1234," son decimales; "20,000" son miles
      dec = ult.length <= 2 ? t.lastIndexOf(',') : -1;
    }
  } else {
    dec = t.lastIndexOf('.');
  }

  if (dec < 0) return t.replace(/[.,]/g, '');

  const ent = t.slice(0, dec).replace(/[.,]/g, '');
  const fra = t.slice(dec + 1).replace(/[.,]/g, '').slice(0, 2);
  return `${ent}.${fra}`;
}

/** Formatea mientras se escribe, conservando el separador decimal recién tecleado. */
export function formatearMilesParcial(texto: string | number | null | undefined): string {
  const t = soloNumerico(texto);
  if (!t) return '';
  const [ent, fra] = t.split('.');
  const limpio = (ent || '0').replace(/^0+(?=\d)/, '');
  const entTxt = limpio.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return t.includes('.') ? `${entTxt}.${fra ?? ''}` : entTxt;
}

/** Formatea un número ya cerrado: 20000 → '20,000'; 1234.5 → '1,234.50'. */
export function formatearMiles(valor: number | string | null | undefined): string {
  const n = typeof valor === 'number' ? valor : aNumero(valor);
  if (n === null || !isFinite(n)) return '';

  const neg = n < 0;
  const abs = Math.abs(n);
  const ent = Math.floor(abs + 1e-9);
  const cents = Math.round((abs - ent) * 100);
  const entTxt = String(ent).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cuerpo = cents > 0 ? `${entTxt}.${String(cents).padStart(2, '0')}` : entTxt;
  return (neg ? '-' : '') + cuerpo;
}

/** Convierte lo escrito (con comas, punto o coma decimal) a número. Nunca NaN. */
export function aNumero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return isFinite(valor) ? valor : null;

  const t = soloNumerico(String(valor));
  if (!t || !/\d/.test(t)) return null;

  const n = Number(t.replace(/\.$/, '')); // '1234.' → 1234
  return isFinite(n) ? n : null;
}

/** Compatibilidad con la versión anterior de la directiva. */
export const limpiarMientrasEscribe = soloNumerico;
