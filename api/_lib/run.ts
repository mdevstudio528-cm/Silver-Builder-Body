/** Envuelve un handler: CORS + manejo uniforme de errores. */
import { HttpError, json, setCors, type Req, type Res } from './http';

export function run(fn: (req: Req, res: Res) => Promise<void> | void) {
  return async (req: Req, res: Res) => {
    setCors(req, res);
    try {
      await fn(req, res);
    } catch (e: any) {
      const status = e instanceof HttpError ? e.status : 500;
      const cuerpo = {
        ok: false,
        error: e?.message || 'Error interno',
        // 'pista' viene de SheetsError: es el texto accionable (403 = falta compartir)
        pista: e?.pista || undefined,
        detail: e?.detail || undefined
      };
      try {
        json(res, status, cuerpo);
      } catch {
        // el manejo del error nunca debe tumbar la función
        const r: any = res;
        r.statusCode = status;
        try { if (typeof r.setHeader === 'function') r.setHeader('Content-Type', 'application/json; charset=utf-8'); } catch {}
        try { if (typeof r.end === 'function') r.end(JSON.stringify(cuerpo)); } catch {}
      }
    }
  };
}
