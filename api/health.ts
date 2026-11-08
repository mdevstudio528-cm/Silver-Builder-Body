import { run } from './_lib/run';
import { json, hoyISO } from './_lib/http';
import { driverActual } from './_lib/store';

export default run(async (_req, res) => {
  const driver = driverActual();
  json(res, 200, {
    ok: true,
    driver,
    hoy: hoyISO(),
    config: {
      sessionSecret: !!process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16,
      sheetsCredenciales: driver === 'sheets'
        ? !!process.env.SHEET_ID && !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON
        : true
    },
    nota: driver === 'file'
      ? 'Modo desarrollo: los usuarios viven en data/users.json. Para producción pon SHEETS_DRIVER=sheets.'
      : 'Modo producción: los usuarios se leen/escriben en Google Sheets privado.'
  });
});
