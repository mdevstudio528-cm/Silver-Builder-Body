/**
 * Perfil guardado en el dispositivo.
 *
 * ¿Por qué existe esto? La sesión real es una cookie httpOnly que pone el
 * servidor (bien: no se puede robar con JavaScript). El problema es que al
 * abrir la PWA instalada SIN internet, la app preguntaba `GET /api/auth/me`
 * para saber quién eras; sin red esa petición falla, la app concluía "no hay
 * sesión" y te mandaba al login… que tampoco funciona sin red. Resultado:
 * no podías registrar un egreso en el súper.
 *
 * Solución: guardar aquí el ÚLTIMO perfil confirmado por el servidor. Sin red
 * se usa este (es solo nombre, correo, rol e id: nunca contraseña ni hash) y en
 * cuanto vuelve la conexión se vuelve a preguntar al servidor.
 *
 * Se guarda en localStorage porque tiene que estar disponible ANTES de abrir
 * IndexedDB y de forma síncrona en el arranque.
 */
import type { Usuario } from './api';

const CLAVE = 'afur.perfil.v1';

/** Días que se acepta el perfil sin conexión. Pasado ese plazo, pide login. */
const MAX_DIAS = 90;

interface Guardado {
  user: Usuario;
  guardado: string;   // ISO
}

export function guardarPerfil(user: Usuario): void {
  try {
    const dato: Guardado = { user, guardado: new Date().toISOString() };
    localStorage.setItem(CLAVE, JSON.stringify(dato));
  } catch {
    /* modo privado o cuota llena: la app sigue funcionando, solo no recuerda */
  }
}

export function leerPerfil(): Usuario | null {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return null;
    const dato = JSON.parse(raw) as Guardado;
    if (!dato?.user?.id) return null;

    const edad = (Date.now() - Date.parse(dato.guardado)) / 86_400_000;
    if (!isFinite(edad) || edad > MAX_DIAS) {
      localStorage.removeItem(CLAVE);
      return null;
    }
    return dato.user;
  } catch {
    return null;
  }
}

export function borrarPerfil(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada */
  }
}

/** Días que lleva guardado el perfil (para avisar en pantalla). */
export function antiguedadPerfil(): number {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return 0;
    const dato = JSON.parse(raw) as Guardado;
    const dias = (Date.now() - Date.parse(dato.guardado)) / 86_400_000;
    return isFinite(dias) ? Math.floor(dias) : 0;
  } catch {
    return 0;
  }
}
