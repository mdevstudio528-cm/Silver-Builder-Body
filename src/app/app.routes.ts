import { Routes } from '@angular/router';
import { authGuard, adminGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'panel' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login.page').then(m => m.LoginPage)
  },
  {
    path: 'cambiar-password',
    loadComponent: () => import('./pages/cambiar-password.page').then(m => m.CambiarPasswordPage)
  },
  {
    path: 'sin-acceso',
    loadComponent: () => import('./pages/sin-acceso.page').then(m => m.SinAccesoPage)
  },
  {
    path: 'panel',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/panel.page').then(m => m.PanelPage)
  },
  {
    path: 'movimientos',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/movimientos.page').then(m => m.MovimientosPage)
  },
  {
    path: 'metas',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/metas.page').then(m => m.MetasPage)
  },
  {
    path: 'admin/cobranza',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/cobranza.page').then(m => m.CobranzaPage)
  },
  {
    path: 'admin/usuarios',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/usuarios.page').then(m => m.UsuariosPage)
  },
  { path: '**', redirectTo: 'panel' }
];
