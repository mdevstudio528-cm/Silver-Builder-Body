/** Envuelve un handler: CORS + manejo uniforme de errores. */
import { HttpError, json, setCors, type Req, type Res } from './http';

export function run(fn: (req: Req, res: Res) => Promise<void> | void) {
  return async (req: Req, res: Res) => {
    setCors(req, res);
    try {
      await fn(req, res);
    } catch (e: any) {
      const status = e instanceof HttpError ? e.status : 500;
      json(res, status, { ok: false, error: e?.message || 'Error interno', detail: e?.detail });
    }
  };
}
