import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API, Usuario } from './api';
import { antiguedadPerfil, borrarPerfil, guardarPerfil, leerPerfil } from './sesion';

/**
 * La sesión real vive en una cookie httpOnly que pone el servidor: aquí no hay
 * tokens en localStorage. Lo que sí se guarda es el ÚLTIMO PERFIL confirmado
 * (nombre, correo, rol, id) para poder abrir la app y registrar movimientos
 * SIN INTERNET, sin que te pida iniciar sesión otra vez.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private _user = signal<Usuario | null>(null);
  private _cargando = signal<boolean>(true);
  private _motivoBloqueo = signal<string>('');
  /** true = el perfil salió del dispositivo porque no hubo red (no confirmado ahora). */
  private _desdeCache = signal<boolean>(false);

  readonly user = this._user.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly motivoBloqueo = this._motivoBloqueo.asReadonly();
  readonly desdeCache = this._desdeCache.asReadonly();

  readonly logueado = computed(() => this._user() !== null);
  readonly esAdmin = computed(() => this._user()?.rol === 'admin');
  readonly debeCambiarPass = computed(() => this._user()?.debeCambiarPass === true);
  readonly nombreCompleto = computed(() => {
    const u = this._user();
    if (!u) return '';
    return [u.nombre, u.ap_paterno, u.ap_materno].filter(Boolean).join(' ');
  });

  readonly diasOffline = computed(() => (this._desdeCache() ? antiguedadPerfil() : 0));

  /**
   * Arranque. Con red: pregunta al servidor y refresca el perfil guardado.
   * Sin red: usa el perfil guardado en el dispositivo y deja entrar.
   * Solo cierra la sesión si el servidor responde 401/403 (sesión inválida o
   * cuenta desactivada), nunca por falta de conexión.
   */
  async inicializar(): Promise<void> {
    try {
      const r = await firstValueFrom(this.http.get<{ user: Usuario }>(`${API}/auth/me`));
      this._user.set(r.user);
      this._desdeCache.set(false);
      guardarPerfil(r.user);
    } catch (e: any) {
      const status = Number(e?.status ?? 0);

      if (status === 401 || status === 403) {
        // el servidor sí contestó y dijo que no: se borra todo
        borrarPerfil();
        this._user.set(null);
        this._desdeCache.set(false);
      } else {
        // status 0 (sin red), 5xx o timeout: se confía en el perfil del dispositivo
        const guardado = leerPerfil();
        this._user.set(guardado);
        this._desdeCache.set(guardado !== null);
      }
    } finally {
      this._cargando.set(false);
    }
  }

  async login(correo: string, password: string): Promise<{ debeCambiarPass: boolean }> {
    const r = await firstValueFrom(
      this.http.post<{ user: Usuario; debeCambiarPass: boolean }>(`${API}/auth/login`, { correo, password })
    );
    this._user.set(r.user);
    this._desdeCache.set(false);
    this._motivoBloqueo.set('');
    guardarPerfil(r.user);
    return { debeCambiarPass: r.debeCambiarPass };
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API}/auth/logout`, {}));
    } catch {
      /* sin red: da igual, abajo se limpia lo local */
    }
    borrarPerfil();
    this._user.set(null);
    this._desdeCache.set(false);
    this.router.navigate(['/login']);
  }

  async cambiarPassword(actual: string, nueva: string): Promise<string> {
    const r = await firstValueFrom(
      this.http.post<{ user: Usuario; mensaje: string }>(`${API}/auth/change-password`, { actual, nueva })
    );
    this._user.set(r.user);
    guardarPerfil(r.user);
    return r.mensaje;
  }

  /** El interceptor avisa aquí cuando el servidor responde 401/403 de verdad. */
  forzarSalida(motivo: string): void {
    this._motivoBloqueo.set(motivo);
    this._user.set(null);
    this._desdeCache.set(false);
    borrarPerfil();
  }
}
