import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * withCredentials es obligatorio: sin él la cookie httpOnly no viaja y todas
 * las peticiones llegarían sin sesión.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  const peticion = req.clone({ withCredentials: true });

  return next(peticion).pipe(
    catchError((err: HttpErrorResponse) => {
      const enLogin = router.url.startsWith('/login');

      if (err.status === 401 && !enLogin) {
        auth.forzarSalida('Tu sesión expiró. Vuelve a entrar.');
        router.navigate(['/login']);
      }
      if (err.status === 403 && !enLogin) {
        const motivo = err.error?.error || 'Tu cuenta ya no tiene acceso.';
        auth.forzarSalida(motivo);
        router.navigate(['/sin-acceso']);
      }
      return throwError(() => err);
    })
  );
};
