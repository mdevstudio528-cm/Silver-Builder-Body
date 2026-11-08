import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API, Usuario } from './api';

/**
 * La sesión vive en una cookie httpOnly que pone el servidor: aquí no hay
 * ningún token guardado en localStorage. Este servicio solo cachea el perfil
 * para pintar la UI y avisa cuando el servidor dice "ya no tienes acceso".
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private _user = signal<Usuario | null>(null);
  private _cargando = signal<boolean>(true);
  private _motivoBloqueo = signal<string>('');

  readonly user = this._user.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly motivoBloqueo = this._motivoBloqueo.asReadonly();

  readonly logueado = computed(() => this._user() !== null);
  readonly esAdmin = computed(() => this._user()?.rol === 'admin');
  readonly debeCambiarPass = computed(() => this._user()?.debeCambiarPass === true);
  readonly nombreCompleto = computed(() => {
    const u = this._user();
    if (!u) return '';
    return [u.nombre, u.ap_paterno, u.ap_materno].filter(Boolean).join(' ');
  });

  /** Se llama una vez al arrancar: pregunta al servidor si la cookie sigue siendo válida. */
  async inicializar(): Promise<void> {
    try {
      const r = await firstValueFrom(this.http.get<{ user: Usuario }>(`${API}/auth/me`));
      this._user.set(r.user);
    } catch {
      this._user.set(null);
    } finally {
      this._cargando.set(false);
    }
  }

  async login(correo: string, password: string): Promise<{ debeCambiarPass: boolean }> {
    const r = await firstValueFrom(
      this.http.post<{ user: Usuario; debeCambiarPass: boolean }>(`${API}/auth/login`, { correo, password })
    );
    this._user.set(r.user);
    this._motivoBloqueo.set('');
    return { debeCambiarPass: r.debeCambiarPass };
  }

  async logout(): Promise<void> {
    try { await firstValueFrom(this.http.post(`${API}/auth/logout`, {})); } catch { /* da igual */ }
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  async cambiarPassword(actual: string, nueva: string): Promise<string> {
    const r = await firstValueFrom(
      this.http.post<{ user: Usuario; mensaje: string }>(`${API}/auth/change-password`, { actual, nueva })
    );
    this._user.set(r.user);
    return r.mensaje;
  }

  /** El interceptor avisa aquí cuando el servidor responde 403. */
  forzarSalida(motivo: string): void {
    this._motivoBloqueo.set(motivo);
    this._user.set(null);
  }
}
