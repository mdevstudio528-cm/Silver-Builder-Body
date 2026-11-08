import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { API } from './api';
import { db, ahora, uid, type LocalMeta, type Prioridad } from './db';

export interface MetaDto {
  nombre: string;
  monto_objetivo: number;
  monto_actual: number;
  fecha_limite: string;
  prioridad: Prioridad;
  aporte_mensual: number;
}

/**
 * Metas con la misma mecánica offline que los movimientos: se guardan primero
 * en IndexedDB con dirty=1 y se suben solas a /api/goals.
 */
@Injectable({ providedIn: 'root' })
export class MetasService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private _metas: LocalMeta[] = [];
  private _oyentes = new Set<() => void>();
  private _subiendo = false;

  private get userKey(): string { return this.auth.user()?.id || ''; }

  get metas(): LocalMeta[] { return this._metas; }
  get pendientes(): number { return this._metas.filter(m => Number(m.dirty) === 1).length; }

  suscribir(fn: () => void): () => void {
    this._oyentes.add(fn);
    return () => this._oyentes.delete(fn);
  }

  private avisar() { this._oyentes.forEach(fn => fn()); }

  private async leerLocal(): Promise<void> {
    if (!this.userKey) { this._metas = []; this.avisar(); return; }
    this._metas = await db.metas.where('user').equals(this.userKey).toArray();
    this.avisar();
  }

  async iniciar(): Promise<void> {
    if (!this.userKey) return;
    await this.leerLocal();
    void this.sincronizar();
  }

  async crear(dto: MetaDto): Promise<void> {
    const marca = ahora();
    const fila: LocalMeta = {
      id: uid(),
      user: this.userKey,
      nombre: dto.nombre.trim().slice(0, 60),
      monto_objetivo: Math.round(Number(dto.monto_objetivo) * 100) / 100,
      monto_actual: Math.round(Number(dto.monto_actual) * 100) / 100,
      fecha_limite: dto.fecha_limite,
      prioridad: dto.prioridad,
      aporte_mensual: Math.round(Number(dto.aporte_mensual || 0) * 100) / 100,
      created_at: marca,
      updated_at: marca,
      deleted: 0,
      dirty: 1
    };
    await db.metas.put(fila);
    await this.leerLocal();
    void this.sincronizar();
  }

  async editar(id: string, dto: MetaDto): Promise<void> {
    const actual = await db.metas.get(id);
    if (!actual) return;
    await db.metas.put({
      ...actual,
      nombre: dto.nombre.trim().slice(0, 60),
      monto_objetivo: Math.round(Number(dto.monto_objetivo) * 100) / 100,
      monto_actual: Math.round(Number(dto.monto_actual) * 100) / 100,
      fecha_limite: dto.fecha_limite,
      prioridad: dto.prioridad,
      aporte_mensual: Math.round(Number(dto.aporte_mensual) * 100) / 100,
      updated_at: ahora(),
      dirty: 1
    });
    await this.leerLocal();
    void this.sincronizar();
  }

  /** Abono rápido: suma (o resta, con signo negativo) al acumulado. */
  async abonar(id: string, monto: number): Promise<void> {
    const actual = await db.metas.get(id);
    if (!actual || !isFinite(monto) || monto === 0) return;
    const nuevo = Math.max(0, Number(actual.monto_actual) + monto);
    await db.metas.put({
      ...actual,
      monto_actual: Math.round(nuevo * 100) / 100,
      updated_at: ahora(),
      dirty: 1
    });
    await this.leerLocal();
    void this.sincronizar();
  }

  async borrar(id: string): Promise<void> {
    const actual = await db.metas.get(id);
    if (!actual) return;
    await db.metas.put({ ...actual, deleted: 1, updated_at: ahora(), dirty: 1 });
    await this.leerLocal();
    void this.sincronizar();
  }

  async sincronizar(): Promise<void> {
    if (this._subiendo || !this.userKey) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this._subiendo = true;
    try {
      const pend = await db.metas.where('user').equals(this.userKey).filter(m => Number(m.dirty) === 1).toArray();
      const res = await firstValueFrom(
        this.http.post<{ ok: boolean; upserted: number; skipped: number; rows: any[] }>(
          `${API}/goals`, { rows: pend.map(this.aServidor) }
        )
      );
      await this.mezclar(res.rows || [], pend.map(p => p.id));
      await this.leerLocal();
    } catch {
      // sin red o servidor caído: queda dirty y se reintenta al volver la conexión
    } finally {
      this._subiendo = false;
    }
  }

  async descargar(): Promise<number> {
    const res = await fetch(`${API}/goals`, { credentials: 'include' });
    const data = await res.json();
    await this.mezclar(data.rows ?? [], []);
    await this.leerListo();
    return (data.rows ?? []).length;
  }

  private async leerListo() { await this.leerLocal(); }

  private aServidor = (m: LocalMeta) => ({
    id: m.id, nombre: m.nombre, monto_objetivo: m.monto_objetivo, monto_actual: m.monto_actual,
    fecha_limite: m.fecha_limite, prioridad: m.prioridad, aporte_mensual: m.aporte_mensual,
    created_at: m.created_at, updated_at: m.updated_at, deleted: Number(m.deleted)
  });

  private async mezclar(servidor: any[], enviados: string[]): Promise<void> {
    const clave = this.userKey;
    await db.transaction('rw', db.metas, async () => {
      for (const s of servidor) {
        if (!s?.id) continue;
        const local = await db.metas.get(String(s.id));
        if (local && String(s.updated_at) < String(local.updated_at)) continue;
        await db.metas.put({
          id: String(s.id), user: clave,
          nombre: String(s.nombre || 'Meta'),
          monto_objetivo: Number(s.monto_objetivo) || 0,
          monto_actual: Number(s.monto_actual) || 0,
          fecha_limite: String(s.fecha_limite || ''),
          prioridad: (['alta', 'media', 'baja'].includes(String(s.prioridad)) ? s.prioridad : 'media') as Prioridad,
          aporte_mensual: Number(s.aporte_mensual) || 0,
          created_at: String(s.created_at || ahora()),
          updated_at: String(s.updated_at || ahora()),
          deleted: Number(s.deleted) === 1 ? 1 : 0,
          dirty: 0
        });
      }
      for (const id of enviados) {
        const local = await db.metas.get(id);
        if (local) await db.metas.update(id, { dirty: 0 });
      }
    });
  }
}
