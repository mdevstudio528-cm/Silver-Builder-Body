import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from './core/auth.service';
import { PwaService } from './core/pwa.service';

@Component({
  selector: 'afz-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    @if (auth.cargando()) {
      <div style="min-height:100vh;display:grid;place-items:center;color:var(--muted)">Cargando…</div>
    } @else {
      @if (pwa.offline()) {
        <div class="aviso-offline">📶 Sin conexión — puedes seguir registrando; todo se sube solo al volver el internet.</div>
      }
      @if (pwa.actualizacion()) {
        <div class="aviso-offline aviso-nuevo">
          ✨ Hay una versión nueva de la app.
          <button class="btn btn--sm" style="margin-left:10px" (click)="pwa.aplicar()">Actualizar</button>
        </div>
      }
      @if (auth.logueado() && !enRutaPublica()) {
        <!-- Barra superior: solo se ve en móvil (CSS la oculta en escritorio) -->
        <header class="mtop">
          <div class="brand">
            <span class="brand__mark">UR</span>
            <div class="mtop__user">
              <b>{{ auth.nombreCompleto() }}</b>
              <span>{{ auth.esAdmin() ? 'Administrador' : 'Cliente' }}</span>
            </div>
          </div>
          <button class="btn btn--ghost btn--sm" (click)="auth.logout()" aria-label="Cerrar sesión">Salir</button>
        </header>
      }
      <div [class.shell]="auth.logueado() && !enRutaPublica()">
        @if (auth.logueado() && !enRutaPublica()) {
          <aside class="sidenav">
            <div class="brand">
              <span class="brand__mark">UR</span>
              <div>
                <strong style="font-size:15px">Finanzas UR</strong>
                <small>administrador</small>
              </div>
            </div>
            <nav>
              <a routerLink="/panel" routerLinkActive="is-active">📊 Panel</a>
              <a routerLink="/movimientos" routerLinkActive="is-active">💸 Movimientos</a>
              <a routerLink="/metas" routerLinkActive="is-active">🎯 Metas</a>
              @if (auth.esAdmin()) {
                <a routerLink="/admin/cobranza" routerLinkActive="is-active">💳 Cobranza</a>
                <a routerLink="/admin/usuarios" routerLinkActive="is-active">👥 Usuarios</a>
              }
            </nav>
            <div class="sidenav__foot">
              <div style="color:var(--txt);font-weight:600">{{ auth.nombreCompleto() }}</div>
              <div>{{ auth.user()?.correo }}</div>
              <span class="pill" [class.pill--ok]="auth.esAdmin()">{{ auth.esAdmin() ? 'Administrador' : 'Usuario' }}</span>
              <button class="btn btn--ghost btn--sm" style="margin-top:6px" (click)="auth.logout()">Salir</button>
            </div>
          </aside>
        }
        <main [class.content]="auth.logueado() && !enRutaPublica()">
          <router-outlet></router-outlet>
        </main>
      </div>

      @if (auth.logueado() && !enRutaPublica()) {
        <!-- Navegación inferior: solo móvil, área táctil de 50px -->
        <nav class="mbottom" aria-label="Navegación">
          <a routerLink="/panel" routerLinkActive="is-active"><em aria-hidden="true">📊</em><span>Panel</span></a>
          <a routerLink="/movimientos" routerLinkActive="is-active"><em aria-hidden="true">💸</em><span>Movimientos</span></a>
          <a routerLink="/metas" routerLinkActive="is-active"><em aria-hidden="true">🎯</em><span>Metas</span></a>
          @if (auth.esAdmin()) {
            <a routerLink="/admin/cobranza" routerLinkActive="is-active"><em aria-hidden="true">💳</em><span>Cobranza</span></a>
            <a routerLink="/admin/usuarios" routerLinkActive="is-active"><em aria-hidden="true">👥</em><span>Usuarios</span></a>
          }
        </nav>
      }
    }
  `
})
export class AppComponent implements OnInit {
  auth = inject(AuthService);
  pwa = inject(PwaService);
  enRutaPublica(): boolean {
    return /^\/(login|cambiar-password|sin-acceso)/.test(location.pathname);
  }
  async ngOnInit() { await this.auth.inicializar(); }
}
