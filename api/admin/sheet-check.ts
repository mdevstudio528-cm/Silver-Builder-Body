/**
 * Diagnóstico de la hoja de Google. Solo administradores.
 *
 *   GET  /api/admin/sheet-check  → ¿las credenciales sirven? ¿qué pestañas hay?
 *   POST /api/admin/sheet-check  → además escribe una fila de prueba, la lee
 *                                  de vuelta y limpia la pestaña _verificacion
 *
 * Sirve para separar "mi código está mal" de "la hoja no está compartida",
 * que es el 90% de los problemas al conectar Google Sheets.
 */
import { run } from '../_lib/run';
import { json, metodoPermitido } from '../_lib/http';
import { requireAdmin } from '../_lib/guard';
import { driverActual } from '../_lib/store';
import {
  verificarCredenciales, sheetsEnsureSheet, sheetsAppendRows,
  sheetsGetValues, sheetsClearRange
} from '../_lib/sheets';

const HOJA_TEST = '_verificacion';
const ENCABEZADOS_TEST = ['prueba', 'cuando', 'quien'];

export default run(async (req, res) => {
  if (!metodoPermitido(req, res, ['GET', 'POST'])) return;

  const admin = await requireAdmin(req);
  const driver = driverActual();
  const diag = await verificarCredenciales();

  const base = {
    driver,
    aviso: driver === 'sheets'
      ? ''
      : 'SHEETS_DRIVER=file: la app funciona, pero está guardando en data/*.json, NO en la hoja. Cambia SHEETS_DRIVER=sheets para escribir en Google Sheets.'
  };

  if (!diag.ok) {
    json(res, 200, {
      ok: true,
      credenciales: { ok: false, error: diag.error, pista: diag.pista },
      prueba: null,
      ...base
    });
    return;
  }

  if (req.method === 'GET') {
    json(res, 200, {
      ok: true,
      credenciales: {
        ok: true, cuenta: diag.cuenta, hoja: diag.hoja,
        sheetId: diag.sheetId, tabs: diag.tabs,
        faltantes: ['usuarios', 'movimientos', 'metas'].filter(t => !(diag.tabs || []).includes(t))
      },
      prueba: null,
      ...base
    });
    return;
  }

  /* -------- POST: escribir, leer de vuelta y limpiar -------- */
  const marca = 'chk_' + Date.now().toString(36);
  await sheetsEnsureSheet(HOJA_TEST, ENCABEZADOS_TEST);
  await sheetsAppendRows(HOJA_TEST, [[marca, new Date().toISOString(), admin.correo]]);

  const filas = await sheetsGetValues(`${HOJA_TEST}!A2:C`);
  const encontrada = filas.some(r => String(r[0]) === marca);
  await sheetsClearRange(`${HOJA_TEST}!A2:C500`);

  json(res, 200, {
    ok: true,
    credenciales: {
      ok: true, cuenta: diag.cuenta, hoja: diag.hoja,
      sheetId: diag.sheetId, tabs: diag.tabs,
      faltantes: ['usuarios', 'movimientos', 'metas'].filter(t => !(diag.tabs || []).includes(t))
    },
    prueba: {
      escritura: encontrada,
      marca,
      filasLeidas: filas.length,
      detalle: encontrada
        ? 'Se escribió una fila, se leyó de vuelta y se limpió. La cuenta de servicio puede leer y escribir.'
        : 'Se escribió pero no se encontró al leer. Revisa que la hoja no tenga filtros raros o celdas protegidas.'
    },
    ...base
  });
});
