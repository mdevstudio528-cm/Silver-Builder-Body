import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'afz-sin-acceso',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px">
      <div class="card" style="max-width:460px;width:100%;text-align:center">
        <div style="font-size:34px;margin-bottom:8px">🔒</div>
        <h2 style="font-size:20px">Tu cuenta está desactivada</h2>
        <p class="nota" style="margin:10px 0 0">
          {{ auth.motivoBloqueo() || 'El administrador desactivó el acceso a esta cuenta.' }}
        </p>
        <p class="nota" style="margin-top:10px">
          Si ya hiciste tu pago o transferencia, avísale al administrador para que reactive tu cuenta.
          Tus datos siguen guardados: no se borra nada al desactivar.
        </p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:18px">
          <button class="btn btn--ghost" (click)="auth.logout()">Cerrar sesión</button>
        </div>
      </div>
    </div>
  `
})
export class SinAccesoPage {
  auth = inject(AuthService);
}
