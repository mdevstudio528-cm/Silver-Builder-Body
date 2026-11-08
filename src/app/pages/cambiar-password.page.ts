import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { mensajeError } from '../core/api';

@Component({
  selector: 'afz-cambiar-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login">
      <section class="login__panel" style="grid-column: 1 / -1">
        <form class="login__box" (ngSubmit)="guardar()">
          <div class="brand">
            <span class="brand__mark">UR</span>
            <div><strong>Finanzas UR</strong><small>primer acceso</small></div>
          </div>

          <div>
            <h2 style="font-size:21px">Cambia tu contraseña</h2>
            <p class="nota" style="margin-top:6px">
              Estás usando una contraseña temporal. Elige una propia antes de continuar:
              mínimo 8 caracteres, con al menos una letra y un número.
            </p>
          </div>

          @if (error()) { <div class="alert alert--bad">{{ error() }}</div> }
          @if (ok()) { <div class="alert alert--ok">{{ ok() }}</div> }

          <label class="field">Contraseña actual (la temporal)
            <input type="password" name="actual" [(ngModel)]="actual" autocomplete="current-password" required>
          </label>

          <label class="field">Nueva contraseña
            <input type="password" name="nueva" [(ngModel)]="nueva" autocomplete="new-password" required>
          </label>

          <label class="field">Repite la nueva contraseña
            <input type="password" name="repite" [(ngModel)]="repite" autocomplete="new-password" required>
          </label>

          @if (nueva && repite && nueva !== repite) {
            <div class="alert alert--warn">Las contraseñas no coinciden.</div>
          }

          <button class="btn btn--block" type="submit"
                  [disabled]="cargando() || !actual || !nueva || nueva !== repite">
            {{ cargando() ? 'Guardando…' : 'Guardar y continuar' }}
          </button>

          <button type="button" class="btn btn--ghost btn--block" (click)="auth.logout()">Salir</button>
        </form>
      </section>
    </div>
  `
})
export class CambiarPasswordPage {
  auth = inject(AuthService);
  private router = inject(Router);

  actual = '';
  nueva = '';
  repite = '';
  cargando = signal(false);
  error = signal('');
  ok = signal('');

  async guardar() {
    if (this.cargando() || this.nueva !== this.repite) return;
    this.cargando.set(true);
    this.error.set('');
    this.ok.set('');
    try {
      const msg = await this.auth.cambiarPassword(this.actual, this.nueva);
      this.ok.set(msg);
      setTimeout(() => this.router.navigate(['/panel']), 900);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
