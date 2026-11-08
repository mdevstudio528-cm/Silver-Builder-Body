import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API, mensajeError } from '../core/api';

interface FilaUsuario {
  id: string; nombre: string; apellido: string; telefono: string; correo: string;
  estatus: 'activo' | 'desactivado'; rol: 'admin' | 'user';
  fecha_alta: string; ultimo_acceso: string; debeCambiarPass: boolean;
}

@Component({
  selector: 'afz-usuarios',
  standalone: true,
  // FormsModule es OBLIGATORIO: sin él, (ngSubmit) no existe y el <form>
  // hace un envío nativo del navegador (GET con ?nombre=...&password=...).
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-head">
      <div>
        <h1>Usuarios</h1>
        <p>Da de alta a tus clientes y controla quién tiene acceso.</p>
      </div>
      <button class="btn" (click)="abrirNuevo()">＋ Nuevo usuario</button>
    </div>

    @if (error()) { <div class="alert alert--bad" style="margin-bottom:14px">{{ error() }}</div> }
    @if (aviso()) { <div class="alert alert--ok" style="margin-bottom:14px">{{ aviso() }}</div> }

    <div class="grid grid--3" style="margin-bottom:16px">
      <div class="card"><div class="kpi__label">Total</div><div class="kpi__value">{{ filas().length }}</div></div>
      <div class="card"><div class="kpi__label">Activos</div><div class="kpi__value" style="color:var(--ok)">{{ activos() }}</div></div>
      <div class="card"><div class="kpi__label">Desactivados</div><div class="kpi__value" style="color:var(--bad)">{{ desactivados() }}</div></div>
    </div>

    <div class="card" style="padding:0;overflow:hidden;border-radius:16px">
      @if (cargando()) {
        <div style="padding:32px;text-align:center;color:var(--muted)">Cargando…</div>
      } @else if (filas().length === 0) {
        <div style="padding:36px;text-align:center;color:var(--muted)">
          <b style="display:block;color:var(--txt);margin-bottom:6px">Aún no hay usuarios</b>
          Crea el primero con el botón de arriba.
        </div>
      } @else {
        <div class="tbl-wrap">
        <table class="tbl tbl--cards">
          <thead>
            <tr>
              <th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Estatus</th>
              <th>Alta</th><th>Último acceso</th><th style="text-align:right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (u of filas(); track u.id) {
              <tr>
                <td class="celda-nombre">
                  <div>{{ u.nombre }} {{ u.apellido }}</div>
                  @if (u.rol === 'admin') { <span class="pill" style="margin-top:4px">admin</span> }
                  @if (u.debeCambiarPass) { <span class="pill" style="margin-top:4px">pass temporal</span> }
                </td>
                <td data-label="Correo" style="color:var(--muted)"><span style="word-break:break-all">{{ u.correo }}</span></td>
                <td data-label="Teléfono" style="color:var(--muted)" class="mono">{{ u.telefono || '—' }}</td>
                <td data-label="Estatus">
                  <span class="pill" [class.pill--ok]="u.estatus === 'activo'" [class.pill--bad]="u.estatus !== 'activo'">
                    {{ u.estatus === 'activo' ? '● Activo' : '● Desactivado' }}
                  </span>
                </td>
                <td data-label="Alta" style="color:var(--muted)" class="mono">{{ u.fecha_alta }}</td>
                <td data-label="Último acceso" style="color:var(--muted)" class="mono">{{ u.ultimo_acceso || 'nunca' }}</td>
                <td data-label="" class="acciones">
                  @if (u.estatus === 'activo') {
                    <button class="btn btn--danger btn--sm" (click)="cambiarEstatus(u, 'desactivar')">Desactivar</button>
                  } @else {
                    <button class="btn btn--sm" (click)="cambiarEstatus(u, 'activar')">Activar</button>
                  }
                  <button class="btn btn--ghost btn--sm" (click)="resetPass(u)">Reset pass</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
        </div>
      }
    </div>

    @if (modal()) {
      <div class="modal" (click)="cerrarModal($event)">
        <div class="modal__box">
          <h3>Nuevo usuario</h3>

          @if (errorModal()) {
            <div class="alert alert--bad" style="margin-bottom:12px">{{ errorModal() }}</div>
          }

          <!-- novalidate: los mensajes los ponemos nosotros, en español y en el campo -->
          <form (ngSubmit)="crear()" novalidate>
            <div class="form-row form-row--2">
              <label class="field">Nombre(s)
                <input name="nombre" [(ngModel)]="nuevo.nombre" autocomplete="off"
                       [style.border-color]="tocado && !nuevo.nombre.trim() ? 'var(--bad)' : null">
                @if (tocado && !nuevo.nombre.trim()) { <small class="nota" style="color:var(--bad)">Escribe el nombre.</small> }
              </label>
              <label class="field">Apellido paterno
                <input name="ap_paterno" [(ngModel)]="nuevo.ap_paterno" autocomplete="off"
                       [style.border-color]="tocado && !nuevo.ap_paterno.trim() ? 'var(--bad)' : null">
                @if (tocado && !nuevo.ap_paterno.trim()) { <small class="nota" style="color:var(--bad)">Escribe el apellido paterno.</small> }
              </label>
            </div>
            <div class="form-row form-row--2">
              <label class="field">Apellido materno (opcional)
                <input name="ap_materno" [(ngModel)]="nuevo.ap_materno" autocomplete="off">
              </label>
              <label class="field">Teléfono (10 dígitos)
                <input name="telefono" [(ngModel)]="nuevo.telefono" inputmode="numeric"
                       (input)="limpiarTelefono($event)" placeholder="7713535455"
                       [style.border-color]="tocado && telDigitos.length < 10 ? 'var(--bad)' : null">
                @if (tocado && telDigitos.length < 10) {
                  <small class="nota" style="color:var(--bad)">
                    Solo números, 10 dígitos. Llevas {{ telDigitos.length }}.
                  </small>
                }
              </label>
            </div>
            <label class="field">Correo
              <input type="email" name="correo" [(ngModel)]="nuevo.correo" autocomplete="off"
                     placeholder="cliente@correo.com"
                     [style.border-color]="tocado && !correoOk ? 'var(--bad)' : null">
              @if (tocado && !correoOk) { <small class="nota" style="color:var(--bad)">Escribe un correo válido.</small> }
            </label>
            <label class="field">Rol de la cuenta
              <select name="rol" [(ngModel)]="nuevo.rol">
                <option value="user">Cliente (usuario normal)</option>
                <option value="admin">Administrador (también da de alta y cobra)</option>
              </select>
            </label>
            <label class="field">Contraseña (opcional: si la dejas vacía se genera una temporal)
              <span class="ojo">
                <input [type]="verPass() ? 'text' : 'password'" name="password" [(ngModel)]="nuevo.password"
                       placeholder="••••••••" autocomplete="new-password">
                <button type="button" class="ojo__btn" (click)="verPass.set(!verPass())"
                        [attr.aria-label]="verPass() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                        [title]="verPass() ? 'Ocultar' : 'Mostrar'">{{ verPass() ? '🙈' : '👁' }}</button>
              </span>
              @if (nuevo.password) {
                <small class="nota">Mínimo 8 caracteres, con letra y número, y que no contenga el correo.</small>
              }
            </label>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button type="button" class="btn btn--ghost" (click)="modal.set(false)">Cancelar</button>
              <button type="submit" class="btn" [disabled]="creando() || !formOk">
                {{ creando() ? 'Creando…' : 'Crear usuario' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    @if (credenciales()) {
      <div class="modal">
        <div class="modal__box">
          <h3>Contraseña temporal</h3>
          <div class="alert alert--warn">
            Cópiala ahora: <b>no se puede volver a mostrar</b>. El usuario deberá cambiarla en su primer acceso.
          </div>
          <div class="card" style="margin-top:12px;text-align:center">
            <div class="nota">Correo</div>
            <div style="font-weight:700;margin:4px 0 12px">{{ credenciales()!.correo }}</div>
            <div class="nota">Contraseña</div>
            <div class="mono" style="font-size:20px;font-weight:800;letter-spacing:.06em;margin-top:4px">
              {{ credenciales()!.password }}
            </div>
          </div>
          <button class="btn btn--block" style="margin-top:14px" (click)="credenciales.set(null)">Listo, ya la guardé</button>
        </div>
      </div>
    }
  `
})
export class UsuariosPage {
  private http = inject(HttpClient);

  filas = signal<FilaUsuario[]>([]);
  cargando = signal(true);
  creando = signal(false);
  error = signal('');
  errorModal = signal('');
  aviso = signal('');
  modal = signal(false);
  tocado = false;
  verPass = signal(false);
  credenciales = signal<{ correo: string; password: string } | null>(null);

  activos = computed(() => this.filas().filter(u => u.estatus === 'activo').length);
  desactivados = computed(() => this.filas().filter(u => u.estatus !== 'activo').length);

  nuevo: { nombre: string; ap_paterno: string; ap_materno: string; telefono: string; correo: string; password: string; rol: 'user' | 'admin' } =
    { nombre: '', ap_paterno: '', ap_materno: '', telefono: '', correo: '', password: '', rol: 'user' };

  /* Getters (no computed): ngModel muta el objeto y los getters se recalculan
     en cada ciclo, así el botón y los avisos reaccionan al escribir. */
  get telDigitos(): string { return String(this.nuevo.telefono || '').replace(/\D/g, ''); }
  get correoOk(): boolean { return /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(String(this.nuevo.correo || '').trim()); }
  get formOk(): boolean {
    return !!this.nuevo.nombre.trim() && !!this.nuevo.ap_paterno.trim() && this.telDigitos.length >= 10 && this.correoOk;
  }

  constructor() { this.cargar(); }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(this.http.get<{ users: FilaUsuario[] }>(`${API}/admin/users`));
      this.filas.set(r.users);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  abrirNuevo() {
    this.nuevo = { nombre: '', ap_paterno: '', ap_materno: '', telefono: '', correo: '', password: '', rol: 'user' };
    this.errorModal.set('');
    this.tocado = false;
    this.modal.set(true);
  }

  /** El teléfono se guarda como dígitos: evita que "rosenda" llegue al servidor. */
  limpiarTelefono(e: Event) {
    const el = e.target as HTMLInputElement;
    const limpio = el.value.replace(/\D/g, '').slice(0, 10);
    if (limpio !== el.value) {
      el.value = limpio;
      this.nuevo.telefono = limpio;
    }
  }

  async crear() {
    this.tocado = true;
    this.errorModal.set('');
    if (this.creando()) return;

    if (!this.formOk) {
      this.errorModal.set('Revisa los campos marcados en rojo.');
      return;
    }

    this.creando.set(true);
    try {
      const r = await firstValueFrom(this.http.post<any>(`${API}/admin/users`, {
        nombre: this.nuevo.nombre.trim(),
        ap_paterno: this.nuevo.ap_paterno.trim(),
        ap_materno: this.nuevo.ap_materno.trim(),
        telefono: this.telDigitos,
        correo: this.nuevo.correo.trim().toLowerCase(),
        password: this.nuevo.password,
        rol: this.nuevo.rol
      }));
      this.modal.set(false);
      if (r.passwordTemporal) this.credenciales.set({ correo: r.user.correo, password: r.passwordTemporal });
      else this.aviso.set(`Usuario ${r.user.correo} creado con la contraseña que elegiste.`);
      await this.cargar();
    } catch (e) {
      // el mensaje del servidor se ve DENTRO del modal, no detrás del fondo
      this.errorModal.set(mensajeError(e));
    } finally {
      this.creando.set(false);
    }
  }

  async cambiarEstatus(u: FilaUsuario, accion: 'activar' | 'desactivar') {
    if (accion === 'desactivar' && !confirm(`¿Desactivar a ${u.correo}? Su sesión se cortará de inmediato.`)) return;
    this.error.set(''); this.aviso.set('');
    try {
      const r = await firstValueFrom(this.http.post<any>(`${API}/admin/user-update`, { id: u.id, accion }));
      this.aviso.set(r.detalle || 'Listo');
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  async resetPass(u: FilaUsuario) {
    if (!confirm(`¿Restablecer la contraseña de ${u.correo}? Se cerrarán todas sus sesiones.`)) return;
    this.error.set(''); this.aviso.set('');
    try {
      const r = await firstValueFrom(this.http.post<any>(`${API}/admin/user-update`, { id: u.id, accion: 'reset-pass' }));
      if (r.passwordTemporal) this.credenciales.set({ correo: u.correo, password: r.passwordTemporal });
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  cerrarModal(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal')) this.modal.set(false);
  }
}
