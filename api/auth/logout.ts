import { run } from '../_lib/run';
import { json, metodoPermitido, serializeCookie, cookieOptions } from '../_lib/http';
import { COOKIE } from '../_lib/guard';

export default run(async (req, res) => {
  if (!metodoPermitido(req, res, ['POST'])) return;
  res.setHeader('Set-Cookie', serializeCookie(COOKIE, '', { ...cookieOptions(0), maxAge: 0 }));
  json(res, 200, { ok: true });
});
