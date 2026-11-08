import { run } from '../_lib/run';
import { json, metodoPermitido } from '../_lib/http';
import { requireUser, publicUser } from '../_lib/guard';

export default run(async (req, res) => {
  if (!metodoPermitido(req, res, ['GET'])) return;
  const u = await requireUser(req);
  json(res, 200, { ok: true, user: publicUser(u), debeCambiarPass: Number(u.debe_cambiar_pass) === 1 });
});
