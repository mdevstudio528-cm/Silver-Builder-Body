/**
 * El corazón de la Fase 2: movimientos que funcionan sin internet.
 *
 * Flujo de una escritura:
 *   1. se guarda en IndexedDB con dirty=1  → la pantalla responde al instante
 *   2. si hay red, se sube el lote a POST /api/sync (idempotente por UUID)
 *   3. el servidor devuelve su verdad y se mezcla (gana el updated_at más nuevo)
 *
 * Si no hay red, nada se pierde: queda en `dirty` y se reintenta al volver la
 * conexión, al entrar a la app y cada 60 segundos.
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API } from './api';
import { AuthService } from './auth.service';
import { db, ahora, uid, type LocalMov, type Tipo } from './db';
import { mesActual, resumen, type Resumen } from './finance';

export interface MovDto {
  fecha: string;
  tipo: Tipo;
  categoria: string;
  descripcion: string;
  monto: number;
  metodo: string;
}

export type SyncEstado = 'inactivo' | 'subiendo' | 'ok' | 'offline' | 'error';

@Injectable({ providedIn: 'root' })
export class MovimientosService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private _rows = signal<LocalMov[]>([]);
  private _mes = signal<string>(mesActual());
  private _estado = signal<SyncEstado>('inactivo');
  private _mensaje = signal('');
  private _ultimaSync = signal<string>('');
  private _listo = signal(false);
  private _subiendo = false;
  private timer: any = null;

  readonly rows = this._rows.asReadonly();
  readonly mes = this._mes.asReadonly();
  readonly estado = this._estado.asReadonly();
  readonly mensaje = this._mensaje.asReadonly();
  readonly ultimaSync = this._ultimaSync.asReadonly();
  readonly listo = this._listo.asReadonly();

  /** Filas que faltan por subir (lo que el usuario ve como "pendientes"). */
  readonly pendientes = computed(() => this._rows().filter(r => Number(r.dirty) === 1).length);

  /** Resumen del mes que se está viendo. */
  readonly resumenMes = computed<Resumen>(() => resumen(this._rows(), this._mes()));

  readonly enLinea = signal(typeof navigator !== 'undefined' ? navigator.onLine : true);

  private get userKey(): string {
    return this.auth.user()?.id || '';
  }

  /* ------------------------------ CARGA ------------------------------ */

  async iniciar(): Promise<void> {
    if (!this.userKey) return;
    await this.leerLocal();
    this._listo.set(true);
    this.engancharRed();
    if (!this.timer) {
      this.timer = setInterval(() => { if (navigator.onLine) void this.sincronizar(true); }, 60_000);
    }
    void this.sincronizar(true);
  }

  private engancharRed() {
    if ((window as any).__afurRed) return;
    (window as any).__afurRed = true;
    window.addEventListener('online', () => { this.enLinea.set(true); void this.sincronizar(true); });
    window.addEventListener('offline', () => { this.enLinea.set(false); this._estado.set('offline'); });
  }

  private async leerLocal(): Promise<void> {
    if (!this.userKey) { this._rows.set([]); return; }
    const filas = await db.movs.where('user').equals(this.userKey).toArray();
    this._rows.set(filas);
  }

  cambiarMes(ym: string) { this._mes.set(ym); }

  /* ------------------------------ ESCRITURA ------------------------------ */

  async crear(dto: MovDto): Promise<void> {
    const marca = ahora();
    const fila: LocalMov = {
      id: uid(),
      user: this.userKey,
      fecha: dto.fecha,
      tipo: dto.tipo,
      categoria: dto.categoria || 'Otro',
      descripcion: (dto.descripcion || '').trim().slice(0, 120),
      monto: Math.round(Number(dto.monto) * 100) / 100,
      metodo: dto.metodo || 'Efectivo',
      created_at: marca,
      updated_at: marca,
      deleted: 0,
      dirty: 1
    };
    await db.movs.put(fila);
    await this.leerLocal();
    this._mes.set(fila.fecha.slice(0, 7));
    void this.sincronizar();
  }

  async editar(id: string, dto: MovDto): Promise<void> {
    const actual = await db.movs.get(id);
    if (!actual) return;
    await db.movs.put({
      ...actual,
      fecha: dto.fecha,
      tipo: dto.tipo,
      categoria: dto.categoria || actual.categoria,
      descripcion: (dto.descripcion || '').trim().slice(0, 120),
      monto: Math.round(Number(dto.monto) * 100) / 100,
      metodo: dto.metodo || actual.metodo,
      updated_at: ahora(),
      dirty: 1
    });
    await this.leerLocal();
    void this.sincronizar();
  }

  /** Borrado lógico: la fila se queda marcada para que el borrado también llegue al servidor. */
  async borrar(id: string): Promise<void> {
    const actual = await db.movs.get(id);
    if (!actual) return;
    await db.movs.put({ ...actual, deleted: 1, updated_at: ahora(), dirty: 1 });
    await this.leerLocal();
    void this.sincronizar();
  }

  /* ------------------------------ SINCRONIZACIÓN ------------------------------ */

  async sincronizar(silencioso = false): Promise<void> {
    if (this._subiendo || !this.userKey) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this._estado.set('offline');
      if (!silencioso) this._mensaje.set('Sin conexión. Tus movimientos quedan guardados en este dispositivo.');
      return;
    }

    this._subiendo = true;
    this._estado.set('subiendo');
    try {
      const pendientes = await db.movs.where('user').equals(this.userKey).filter(r => Number(r.dirty) === 1).toArray();
      const cuerpo = { rows: pendientes.map(this.aServidor) };

      const res = await firstValueFrom(
        this.http.post<{ ok: boolean; upserted: number; skipped: number; rows: any[]; serverTime: string }>(
          `${API}/sync`, cuerpo
        )
      );

      await this.mezclar(res.rows || [], pendientes.map(p => p.id));
      await this.leerLocal();

      this._ultimaSync.set(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
      this._estado.set('ok');
      this._mensaje.set(
        pendientes.length === 0
          ? 'Todo al día con el servidor.'
          : `Sincronizado: ${res.upserted} guardado(s), ${res.skipped} sin cambios.`
      );
    } catch (e: any) {
      this._estado.set(e?.status === 0 ? 'offline' : 'error');
      this._mensaje.set(
        e?.status === 0
          ? 'Sin conexión con el servidor. Se reintentará automáticamente.'
          : (e?.error?.error || 'No se pudo sincronizar. Se reintentará.')
      );
    } finally {
      this._subiendo = false;
    }
  }

  /** Lo que viaja al servidor: sin el campo `user` (el servidor lo pone desde la cookie). */
  private aServidor = (r: LocalMov) => ({
    id: r.id, fecha: r.fecha, tipo: r.tipo, categoria: r.categoria,
    descripcion: r.descripcion, monto: r.monto, metodo: r.metodo,
    created_at: r.created_at, updated_at: r.updated_at, deleted: Number(r.deleted)
  });

  /** Gana la versión más nueva. Los ids enviados quedan confirmados (dirty=0). */
  private async mezclar(servidor: any[], enviados: string[]): Promise<void> {
    const clave = this.userKey;
    await db.transaction('rw', db.movs, async () => {
      for (const s of servidor) {
        if (!s?.id) continue;
        const local = await db.movs.get(s.id);
        const servidorMasNuevo = !local || String(s.updated_at) >= String(local.updated_at);
        if (!servidorMasNuevo) continue;
        await db.movs.put({
          id: String(s.id), user: clave,
          fecha: String(s.fecha), tipo: s.tipo === 'ingreso' ? 'ingreso' : 'egreso',
          categoria: String(s.categoria || 'Otro'), descripcion: String(s.descripcion || ''),
          monto: Number(s.monto) || 0, metodo: String(s.metodo || ''),
          created_at: String(s.created_at || ahora()), updated_at: String(s.updated_at || ahora()),
          deleted: Number(s.deleted) === 1 ? 1 : 0,
          dirty: 0
        });
      }
      for (const id of enviados) {
        const local = await db.movs.get(id);
        if (local) await db.movs.update(id, { dirty: 0 });
      }
    });
  }

  /** Trae todo del servidor (otro equipo, o reinstalaste el navegador). */
  async descargarTodo(): Promise<number> {
    const res = await firstValueFrom(this.http.get<{ ok: boolean; rows: any[] }>(`${API}/sync`));
    await this.mezclar(res.rows || [], []);
    await this.leerLocal();
    return (res.rows || []).length;
  }
}
