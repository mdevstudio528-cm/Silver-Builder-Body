/**
 * Base local del navegador (IndexedDB vía Dexie). Es la fuente de verdad mientras
 * no hay internet: se escribe aquí primero y luego se sube.
 */
import Dexie, { type Table } from 'dexie';

export type Tipo = 'ingreso' | 'egreso';
export type Prioridad = 'alta' | 'media' | 'baja';

export interface LocalMov {
  id: string;
  user: string;          // id del dueño, para que en un mismo equipo no se mezclen cuentas
  fecha: string;         // YYYY-MM-DD
  tipo: Tipo;
  categoria: string;
  descripcion: string;
  monto: number;
  metodo: string;
  created_at: string;
  updated_at: string;
  deleted: number;       // 1 = borrado (tombstone, para propagarlo al servidor)
  dirty: number;         // 1 = falta subirlo
}

export interface LocalMeta {
  id: string;
  user: string;
  nombre: string;
  monto_objetivo: number;
  monto_actual: number;
  fecha_limite: string;
  prioridad: Prioridad;
  aporte_mensual: number;
  created_at: string;
  updated_at: string;
  deleted: number;
  dirty: number;
}

export class AfzDB extends Dexie {
  movs!: Table<LocalMov, string>;
  metas!: Table<LocalMeta, string>;
  kv!: Table<{ k: string; v: any }, string>;

  constructor() {
    super('afur-finanzas');
    this.version(1).stores({
      movs: 'id, user, fecha, tipo, dirty, [user+fecha]',
      kv: 'k'
    });
    // v2: metas de ahorro (las tablas de v1 se conservan tal cual)
    this.version(2).stores({
      metas: 'id, user, dirty, fecha_limite'
    });
  }
}

export const db = new AfzDB();

export function uid(): string {
  const c: any = typeof crypto !== 'undefined' ? crypto : null;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 24);
  return 'm' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-6);
}

export const ahora = () => new Date().toISOString();

/** Fecha de HOY en hora local del usuario (no UTC: evita el clásico "se me fue al día anterior"). */
export function hoyLocal(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function kvGet<T>(k: string): Promise<T | null> {
  const r = await db.kv.get(k);
  return (r?.v ?? null) as T | null;
}

export async function kvSet(k: string, v: any): Promise<void> {
  await db.kv.put({ k, v });
}
