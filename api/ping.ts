/**
 * GET /api/ping — función de diagnóstico con CERO imports.
 * Si /api/ping responde y /api/health no, el problema está en la cadena de
 * imports de _lib; si ping tampoco responde, es configuración del proyecto
 * en Vercel (build/outputDirectory/functions), no el código.
 */
export default function handler(req: any, res: any) {
  const cuerpo = JSON.stringify({
    ok: true,
    ping: 'pong',
    node: process.version,
    region: process.env.VERCEL_REGION || '',
    runtime: { tieneStatus: typeof res?.status === 'function', tieneJson: typeof res?.json === 'function' }
  });
  try {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      res.status(200).json(JSON.parse(cuerpo));
      return;
    }
  } catch { /* cae al modo nativo */ }
  res.statusCode = 200;
  if (typeof res.setHeader === 'function') res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(cuerpo);
}
