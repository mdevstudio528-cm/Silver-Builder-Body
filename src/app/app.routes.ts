import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/home.page').then(m => m.HomePage) },
  { path: 'rutina/:dia', loadComponent: () => import('./pages/rutina.page').then(m => m.RutinaPage) },
  { path: 'play/:dia', loadComponent: () => import('./pages/play.page').then(m => m.PlayPage) },
  { path: '**', redirectTo: '' }
];
