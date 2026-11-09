/**
 * Contraseñas y sesiones. Sin dependencias: todo con crypto de Node.
 *
 * - Contraseñas: scrypt (memory-hard) con sal aleatoria por usuario.
 *   El hash es autodescriptivo → se pueden subir los parámetros sin romper los viejos.
 * - Sesiones: JWT HS256 firmado con SESSION_SECRET, entregado en cookie httpOnly.
 *   El navegador nunca ve ni guarda el token en JS.
 */
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto';
import { HttpError } from './http';

const N = 16384, R = 8, P = 1, KEYLEN = 32;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(String(plain).normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P });
  return ['scrypt', N, 8, 1, salt.toString('base64'), hash.toString('base64')].join('$');
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  let expected: Buffer;
  try { expected = Buffer.from(hashB64, 'base64'); } catch { return false; }
  if (!expected.length) return false;
  const actual = scryptSync(String(plain).normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p)
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') throw new HttpError(500, 'Falta SESSION_SECRET');
  return 'dev-secret-solo-para-local-no-usar-en-produccion';
}

const b64u = (s: string | Buffer) => Buffer.from(s as any).toString('base64url');

export interface SessionClaims { uid: string; sv: number; iat: number; exp: number }

export function signSession(uid: string, sv: number, days = 90): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ uid, sv, iat: now, exp: now + days * 86400 }));
  const sig = createHmac('sha256', secret()).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verifySession(token: string | undefined): SessionClaims {
  const [head, body, sig] = String(token || '').split('.');
  if (!head || !body || !sig) throw new HttpError(401, 'Sin sesión');
  const expected = createHmac('sha256', secret()).update(`${head}.${body}`).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, 'Firma de sesión inválida');
  let claims: SessionClaims;
  try { claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); }
  catch { throw new HttpError(401, 'Sesión corrupta'); }
  if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) throw new HttpError(401, 'Sesión expirada');
  return claims;
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';
/** Contraseña temporal legible, sin caracteres ambiguos (0/O, 1/l/I). */
export function generarPasswordTemporal(largo = 12): string {
  const bytes = randomBytes(largo);
  let out = '';
  for (let i = 0; i < largo; i++) out += ALFABETO[bytes[i] % ALFABETO.length];
  return out;
}

export function validarPasswordNueva(pass: string, correo: string): string | null {
  if (typeof pass !== 'string' || pass.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (pass.length > 72) return 'La contraseña es demasiado larga';
  if (pass.toLowerCase().includes(String(correo || '').split('@')[0].toLowerCase()) && correo)
    return 'La contraseña no puede contener tu correo';
  if (!/[a-zA-Z]/.test(pass) || !/[0-9]/.test(pass)) return 'Usa al menos una letra y un número';
  return null;
}
