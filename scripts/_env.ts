/**
 * Carga .env sin dependencias (para los scripts de consola).
 *
 * Reglas:
 *   - si la variable ya existe en el entorno real, manda el entorno
 *     (así funciona  $env:SHEETS_DRIVER="sheets"  en PowerShell);
 *     un valor VACÍO cuenta como no definido
 *   - dentro del archivo gana la ÚLTIMA aparición de cada clave: una línea
 *     vieja como SHEETS_DRIVER=file ya no puede pisar la nueva
 *   - avisa por consola si hay claves duplicadas (síntoma de un .env mal pegado)
 *   - avisa si GOOGLE_SERVICE_ACCOUNT_JSON quedó roto, en vez de fallar 500
 *     más tarde dentro del login
 *   - quita comillas envolventes y soporta valores con = adentro (JSON, base64)
 *   - quita el BOM y los \r de Windows
 *   - NO toca los \n internos: el JSON de la cuenta de servicio va en 1 línea
 *     y sus \n deben quedar escapados o JSON.parse falla
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const envPath = join(process.cwd(), '.env');

if (existsSync(envPath)) {
  let crudo = readFileSync(envPath, 'utf8');
  if (crudo.charCodeAt(0) === 0xfeff) crudo = crudo.slice(1);

  const valores = new Map<string, string>();
  const veces = new Map<string, number>();

  for (const linea of crudo.split(/\r?\n/)) {
    if (!linea.trim() || /^\s*#/.test(linea)) continue;
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]*)$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2].trim();
    if (v.length > 1 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
      v = v.slice(1, -1);
    }
    valores.set(k, v); // la última aparición gana
    veces.set(k, (veces.get(k) || 0) + 1);
  }

  for (const [k, n] of veces) {
    if (n > 1) console.warn(`  ! .env: "${k}" aparece ${n} veces; se usó la última`);
  }

  for (const [k, v] of valores) {
    const actual = process.env[k];
    if (actual !== undefined && actual !== '') continue;
    process.env[k] = v;
  }

  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (sa) {
    try {
      const o = JSON.parse(sa);
      if (!o.client_email || !o.private_key) {
        console.warn('  ! GOOGLE_SERVICE_ACCOUNT_JSON no tiene client_email/private_key');
      }
    } catch {
      console.warn('  ! GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido en .env');
      console.warn('    corrige con:  node arreglar-env.mjs');
    }
  }
}
