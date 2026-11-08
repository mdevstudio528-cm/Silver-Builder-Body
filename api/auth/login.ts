import { run } from '../_lib/run';
import { HttpError, json, requireBody, metodoPermitido, serializeCookie, cookieOptions, hoyISO } from '../_lib/http';
import { verifyPassword, signSession } from '../_lib/auth';
import { getStore } from '../_lib/store';
import { COOKIE, publicUser } from '../_lib/guard';

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

export default run(async (req, res) => {
  if (!metodoPermitido(req, res, ['POST'])) return;

  const body = requireBody(req);
  const correo = String(body.correo || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!correo || !password) throw new HttpError(400, 'Escribe tu correo y contraseña');

  const store = getStore();
  const u = await store.findByEmail(correo);

  // Bloqueo por fuerza bruta (se revisa antes de gastar CPU en scrypt)
  if (u && u.bloqueado_hasta && Date.parse(u.bloqueado_hasta) > Date.now()) {
    const min = Math.ceil((Date.parse(u.bloqueado_hasta) - Date.now()) / 60000);
    throw new HttpError(429, `Demasiados intentos. Intenta de nuevo en ${min} minuto(s).`);
  }

  // Hash señuelo: si el correo no existe se ejecuta igual el cálculo de scrypt,
  // y así el tiempo de respuesta no revela qué correos están dados de alta.
  const señuelo = 'scrypt$16384$8$1$' + Buffer.alloc(16).toString('base64') + '$' + Buffer.alloc(32).toString('base64');
  const passwordOk = verifyPassword(password, u?.hash || señuelo);

  if (!u || !passwordOk) {
    if (u) {
      const intentos = Number(u.intentos_fallidos || 0) + 1;
      const patch: any = { intentos_fallidos: intentos };
      if (intentos >= MAX_INTENTOS) {
        patch.bloqueado_hasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60000).toISOString();
        patch.intentos_fallidos = 0;
      }
      await store.update(u.id, patch);
    }
    throw new HttpError(401, 'Correo o contraseña incorrectos');
  }

  // Ya demostró que es él: hasta aquí se revela el estatus
  if (String(u.estatus) !== 'activo') {
    throw new HttpError(403, 'Cuenta desactivada. Contacta al administrador para reactivarla.');
  }

  const token = signSession(u.id, Number(u.session_version || 1));
  res.setHeader('Set-Cookie', serializeCookie(COOKIE, token, cookieOptions(7 * 86400)));

  await store.update(u.id, {
    ultimo_acceso: new Date().toISOString().slice(0, 16).replace('T', ' '),
    intentos_fallidos: 0,
    bloqueado_hasta: ''
  });

  json(res, 200, {
    ok: true,
    user: publicUser({ ...u, ultimo_acceso: hoyISO() }),
    debeCambiarPass: Number(u.debe_cambiar_pass) === 1
  });
});
