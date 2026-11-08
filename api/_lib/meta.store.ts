/**
 * Almacén de metas de ahorro. Misma interfaz para los dos drivers:
 *   - 'file'   → data/metas.json (desarrollo)
 *   - 'sheets' → pestaña "metas" de la hoja privada (producción)
 * Escrituras por lote en Sheets (1 append + 1 batchUpdate).
 */
import type { MetaRow, Prioridad } from './meta.types';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { sheetsGetValues, sheetsAppendRows, sheetsBatchUpdate, sheetsEnsureSheet } from './sheets';

export interface MetaStore {
  ensureSchema(): Promise<void>;
  byUser(userId: string): Promise<MetaRow[]>;
  upsertMany(userId: string, incoming: Partial<MetaRow>[]): Promise<{ upserted: number; skipped: number }>;
}

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'metas.json');

const PRIORIDADES: Prioridad[] = ['alta', 'media', 'baja'];

/** Valida y normaliza una meta que llega del navegador. */
export function normalizarMeta(raw: Partial<MetaRow>, userId: string): MetaRow | null {
  const id = String(raw?.id ?? '').trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null;

  const nombre = String(raw?.nombre ?? '').trim().slice(0, 60);
  if (nombre.length < 1) return null;

  const objetivo = Number(raw?.monto_objetivo);
  if (!isFinite(objetivo) || objetivo <= 0 || objetivo > 1_000_000_000) return null;

  const actual = Number(raw?.monto_actual);
  if (!isFinite(actual) || actual < 0 || actual > 1_000_000_000) return null;

  const limite = String(raw?.fecha_limite ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limite)) return null;

  const aporte = Number(raw?.aporte_mensual ?? 0);
  if (!isFinite(aporte) || aporte < 0 || aporte > 1_000_000_000) return null;

  const ahora = new Date().toISOString();
  return {
    id,
    user_id: userId,
    nombre,
    monto_objetivo: Math.round(objetivo * 100) / 100,
    monto_actual: Math.round(actual * 100) / 100,
    fecha_limite: limite,
    prioridad: PRIORIDADES.includes(raw?.prioridad as Prioridad) ? (raw!.prioridad as Prioridad) : 'media',
    aporte_mensual: Math.round(aporte * 100) / 100,
    created_at: String(raw?.created_at ?? ahora).slice(0, 32),
    updated_at: String(raw?.updated_at ?? ahora).slice(0, 32),
    deleted: Number(raw?.deleted) === 1 ? 1 : 0
  };
}

/* ------------------------------ FILE ------------------------------ */
class FileMetas implements MetaStore {
  private carga(): MetaRow[] {
    if (!existsSync(FILE)) return [];
    try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return []; }
  }
  private guarda(rows: MetaRow[]): void {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(rows, null, 2), 'utf8');
  }
  async ensureSchema() { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); }
  async byUser(userId: string) { return this.carga().filter(r => r.user_id === userId); }

  async upsertMany(userId: string, incoming: Partial<MetaRow>[]) {
    const rows = this.carga();
    let upserted = 0, skipped = 0;
    for (const raw of incoming) {
      const r = normalizarMeta(raw, userId);
      if (!r) { skipped++; continue; }
      const i = rows.findIndex(x => x.id === r.id && x.user_id === userId);
      if (i < 0) { rows.push(r); upserted++; continue; }
      if (String(rows[i].updated_at) >= String(r.updated_at)) { skipped++; continue; }
      rows[i] = { ...rows[i], ...r };
      upserted++;
    }
    this.guarda(rows);
    return { upserted, skipped };
  }
}

/* ------------------------------ SHEETS ------------------------------ */
const HOJA = 'metas';
const COLUMNAS: (keyof MetaRow)[] = [
  'id', 'user_id', 'nombre', 'monto_objetivo', 'monto_actual', 'fecha_limite',
  'prioridad', 'aporte_mensual', 'created_at', 'updated_at', 'deleted'
];
const ENCABEZADOS = COLUMNAS.map(String);
const ULTIMA = 'K';

class SheetsMetas implements MetaStore {
  async ensureSchema() { await sheetsEnsureSheet(HOJA, ENCABEZADOS); }

  private async filas(): Promise<{ row: MetaRow; index: number }[]> {
    const values = await sheetsGetValues(`${HOJA}!A2:${ULTIMA}`);
    return values.map((r, i) => {
      const o: any = {};
      COLUMNAS.forEach((k, j) => { o[k] = r[j] ?? ''; });
      o.monto_objetivo = Number(o.monto_objetivo || 0);
      o.monto_actual = Number(o.monto_actual || 0);
      o.aporte_mensual = Number(o.aporte_mensual || 0);
      o.deleted = Number(o.deleted || 0);
      return { row: o as MetaRow, index: i + 2 };
    });
  }

  async byUser(userId: string) {
    return (await this.filas()).filter(f => String(f.row.user_id) === userId).map(f => f.row);
  }

  async upsertMany(userId: string, incoming: Partial<MetaRow>[]) {
    let skipped = 0;
    const validas: MetaRow[] = [];
    for (const raw of incoming) {
      const r = normalizarMeta(raw, userId);
      if (!r) { skipped++; continue; }
      validas.push(r);
    }
    if (!validas.length) return { upserted: 0, skipped };

    const filas = await this.filas();
    const nuevas: MetaRow[] = [];
    const cambios: { range: string; values: (string | number)[][] }[] = [];
    let upserted = 0;

    for (const r of validas) {
      const f = filas.find(x => String(x.row.id) === r.id && String(x.row.user_id) === userId);
      if (!f) { nuevas.push(r); upserted++; continue; }
      if (String(f.row.updated_at) >= String(r.updated_at)) { skipped++; continue; }
      cambios.push({
        range: `${HOJA}!A${f.index}:${ULTIMA}${f.index}`,
        values: [COLUMNAS.map(k => ((r as any)[k] ?? '') as string | number)]
      });
      upserted++;
    }

    if (nuevas.length) await sheetsAppendRows(HOJA, nuevas.map(r => COLUMNAS.map(k => ((r as any)[k] ?? '') as string | number)));
    if (cambios.length) await sheetsBatchUpdate(cambios);

    return { upserted, skipped };
  }
}

const driver = () => String(process.env.SHEETS_DRIVER || 'file').toLowerCase();

export function getMetaStore(): MetaStore {
  return driver() === 'sheets' ? new SheetsMetas() : new FileMetas();
}

export function publicMeta(r: MetaRow) {
  return {
    id: r.id, nombre: r.nombre,
    monto_objetivo: Number(r.monto_objetivo), monto_actual: Number(r.monto_actual),
    fecha_limite: r.fecha_limite, prioridad: r.prioridad,
    aporte_mensual: Number(r.aporte_mensual),
    created_at: r.created_at, updated_at: r.updated_at, deleted: Number(r.deleted)
  };
}
