/**
 * Verifica la conexión con Google Sheets ANTES de meter datos reales.
 *
 * Uso:  npm run verificar:hoja
 *
 * Qué hace, en orden, y se detiene en el primer fallo:
 *   1. ¿están SHEET_ID y GOOGLE_SERVICE_ACCOUNT_JSON?
 *   2. ¿Google acepta la firma de la cuenta de servicio? (token OAuth real)
 *   3. ¿la cuenta de servicio puede abrir la hoja? (el 403 de "falta compartir")
 *   4. crea las pestañas usuarios / movimientos / metas / pagos con sus encabezados
 *   5. escribe una fila en _verificacion, la lee de vuelta y la limpia
 */
import './_env';
import { verificarCredenciales, sheetsEnsureSheet, sheetsAppendRows, sheetsGetValues, sheetsClearRange } from '../api/_lib/sheets';
import { COLUMNAS as COLS_USERS } from '../api/_lib/store';
import { getMovStore } from '../api/_lib/mov.store';
import { getMetaStore } from '../api/_lib/meta.store';
import { getPagoStore } from '../api/_lib/pago.store';

const HOJA_TEST = '_verificacion';
const ENCABEZADOS_TEST = ['prueba', 'cuando', 'quien'];

const ok = (t: string) => console.log(`  ✓ ${t}`);
const mal = (t: string, pista = '') => {
  console.log(`  ✗ ${t}`);
  if (pista) console.log(`    → ${pista}`);
};
const paso = (n: number, t: string) => console.log(`\n${n}. ${t}`);

async function main() {
  console.log('\n=== Verificación de la hoja de Google ===');

  paso(1, 'Variables de entorno');
  const sheetId = process.env.SHEET_ID;
  const cred = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!sheetId) { mal('Falta SHEET_ID', 'Pon el id de la hoja NUEVA en .env (no la de Urban Rocket).'); process.exit(1); }
  ok(`SHEET_ID = ${sheetId.slice(0, 12)}…`);
  if (!cred) { mal('Falta GOOGLE_SERVICE_ACCOUNT_JSON', 'Pega el JSON completo de la clave de la cuenta de servicio.'); process.exit(1); }
  ok(`GOOGLE_SERVICE_ACCOUNT_JSON presente (${cred.length} caracteres)`);

  paso(2, 'Firma y token de la cuenta de servicio');
  paso(3, 'Acceso a la hoja');
  const diag = await verificarCredenciales();
  if (!diag.ok) {
    mal(diag.error || 'No se pudo autenticar', diag.pista);
    console.log('\n  Nada se escribió. Corrige eso y vuelve a correr: npm run verificar:hoja\n');
    process.exit(1);
  }
  ok(`Token obtenido con ${diag.cuenta}`);
  ok(`Hoja encontrada: "${diag.hoja}"`);
  console.log(`    pestañas actuales: ${(diag.tabs || []).join(', ') || '(ninguna)'}`);

  paso(4, 'Crear pestañas y encabezados');
  if (!Array.isArray(COLS_USERS) || COLS_USERS.length !== 15) {
    mal('No se pudieron leer las columnas de "usuarios"', 'store.ts debe exportar COLUMNAS (15 campos de UserRow).');
    process.exit(1);
  }
  try {
    await sheetsEnsureSheet('usuarios', COLS_USERS as unknown as string[]);
    ok(`usuarios (${COLS_USERS.length} columnas)`);
    await getMovStore().ensureSchema();
    ok('movimientos (11 columnas)');
    await getMetaStore().ensureSchema();
    ok('metas (11 columnas)');
    await getPagoStore().ensureSchema();
    ok('pagos (12 columnas)');
  } catch (e: any) {
    mal(e?.message || 'No se pudieron crear las pestañas', e?.pista || '');
    process.exit(1);
  }

  paso(5, 'Escritura real de prueba');
  await sheetsEnsureSheet(HOJA_TEST, ENCABEZADOS_TEST);
  const marca = 'chk_' + Date.now().toString(36);
  await sheetsAppendRows(HOJA_TEST, [[marca, new Date().toISOString(), 'verificar-hoja']]);
  const filas = await sheetsGetValues(`${HOJA_TEST}!A2:C`);
  const encontrada = filas.some(r => String(r[0]) === marca);
  await sheetsClearRange(`${HOJA_TEST}!A2:C500`);

  if (!encontrada) {
    mal('Se escribió pero no se leyó de vuelta', 'Revisa que la hoja no tenga celdas protegidas o filtros.');
    process.exit(1);
  }
  ok(`Fila ${marca} escrita y leída (${filas.length} fila(s) en el rango). Pestaña limpiada.`);

  console.log('\n=== Listo: la hoja responde ===');
  console.log('  Para que la app escriba ahí y no en data/*.json, en .env:');
  console.log('     SHEETS_DRIVER=sheets');
  console.log('  Después reinicia la API (npm run dev:api).\n');
}

main().catch((e) => {
  console.error('\n✗ Error inesperado:', e?.message || e);
  if (e?.pista) console.error('  →', e.pista);
  process.exit(1);
});
