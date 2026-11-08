import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.cargando()) await auth.inicializar();

  if (!auth.logueado()) return router.createUrlTree(['/login']);
  if (auth.debeCambiarPass()) return router.createUrlTree(['/cambiar-password']);
  return true;
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.cargando()) await auth.inicializar();

  if (!auth.logueado()) return router.createUrlTree(['/login']);
  if (!auth.esAdmin()) return router.createUrlTree(['/panel']);
  return true;
};

/** Entra a /login solo quien NO tiene sesión. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.cargando()) await auth.inicializar();
  if (!auth.logueado()) return true;
  return router.createUrlTree([auth.debeCambiarPass() ? '/cambiar-password' : '/panel']);
};
