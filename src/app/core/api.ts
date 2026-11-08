import { HttpErrorResponse } from '@angular/common/http';

/** En desarrollo, proxy.conf.json manda /api → localhost:3001. En producción es el mismo dominio. */
export const API = '/api';

export interface Usuario {
  id: string;
  nombre: string;
  ap_materno?: string;
  ap_paterno?: string;
  telefono?: string;
  correo: string;
  rol: 'admin' | 'user';
  estatus: 'activo' | 'desactivado';
  fecha_alta?: string;
  ultimo_acceso?: string;
  debeCambiarPass: boolean;
}

/** Traduce la respuesta de error del backend a un texto mostrable. */
export function mensajeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'No hay conexión con el servidor. Revisa que la API esté corriendo (npm run dev:api).';
    const msg = err.error?.error;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (err.status === 401) return 'Tu sesión expiró. Vuelve a entrar.';
    if (err.status === 403) return 'No tienes permiso para esta acción.';
    if (err.status === 429) return 'Demasiados intentos. Espera unos minutos.';
    return `Error ${err.status}`;
  }
  return 'Ocurrió un error inesperado.';
}
