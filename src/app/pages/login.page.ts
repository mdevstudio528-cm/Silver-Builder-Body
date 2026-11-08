import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { mensajeError } from '../core/api';

@Component({
  selector: 'afz-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login">
      <section class="login__art">
        <div class="brand">
          <span class="brand__mark">UR</span>
          <div>
            <strong>Finanzas UR</strong>
            <small>administrador financiero</small>
          </div>
        </div>
        <h1>Tu dinero,<br>con claridad diaria.</h1>
        <p>Control de ingresos y egresos, metas a corto y largo plazo, y proyecciones reales sobre tu ritmo de ahorro. Acceso privado: solo entran las cuentas dadas de alta por el administrador.</p>
        <ul class="limpia">
          <li><b>Registro diario</b> de cada movimiento en segundos.</li>
          <li><b>Metas</b> con fecha y cuánto necesitas ahorrar al mes.</li>
          <li><b>Cada quien ve solo lo suyo</b>, ni más ni menos.</li>
        </ul>
      </section>

      <section class="login__panel">
        <form class="login__box" (ngSubmit)="entrar()">
          <div>
            <h2 style="font-size:22px">Entrar</h2>
            <p class="nota" style="margin-top:6px">Usa el correo y la contraseña que te entregó el administrador.</p>
          </div>

          @if (error()) {
            <div class="alert alert--bad">{{ error() }}</div>
          }

          <label class="field">Correo
            <input type="email" name="correo" [(ngModel)]="correo" autocomplete="username"
                   placeholder="tu@correo.com" required>
          </label>

          <label class="field">Contraseña
            <span class="ojo">
              <input [type]="mostrar() ? 'text' : 'password'" name="password" [(ngModel)]="password"
                     autocomplete="current-password" placeholder="••••••••" required>
              <button type="button" class="ojo__btn" (click)="mostrar.set(!mostrar())"
                      [attr.aria-label]="mostrar() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                      [title]="mostrar() ? 'Ocultar' : 'Mostrar contraseña'"
                      [attr.aria-pressed]="mostrar()">{{ mostrar() ? '🙈' : '👁' }}</button>
            </span>
          </label>

          <button class="btn btn--block" type="submit" [disabled]="cargando() || !correo || !password">
            {{ cargando() ? 'Verificando…' : 'Entrar' }}
          </button>

          <p class="nota">
            ¿Olvidaste tu contraseña o tu cuenta aparece desactivada? Escribe al administrador;
            él puede restablecerla y reactivar tu acceso.
          </p>
        </form>
      </section>
    </div>
  `
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);

  correo = '';
  password = '';
  cargando = signal(false);
  mostrar = signal(false);
  error = signal('');

  async entrar() {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set('');
    try {
      const r = await this.auth.login(this.correo.trim().toLowerCase(), this.password);
      this.router.navigate([r.debeCambiarPass ? '/cambiar-password' : '/panel']);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
