/**
 * Almacén de movimientos. Misma interfaz para los dos drivers:
 *   - 'file'   → data/movimientos.json (desarrollo)
 *   - 'sheets' → pestaña "movimientos" de la hoja privada (producción)
 * Regla de oro: user_id nunca viene del cliente, lo inyecta el servidor.
 *
 * En Sheets las escrituras van por LOTE (1 append + 1 batchUpdate) para no
 * reventar la cuota de 60 peticiones/minuto.
 */
import type { MovRow } from './mov.types';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { sheetsGetValues, sheetsAppendRows, sheetsBatchUpdate, sheetsEnsureSheet } from './sheets';

export interface MovStore {
  ensureSchema(): Promise<void>;
  byUser(userId: string): Promise<MovRow[]>;
  upsertMany(userId: string, incoming: Partial<MovRow>[]): Promise<{ upserted: number; skipped: number }>;
}

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'movimientos.json');

/** Valida y normaliza UNA fila que llega del cliente. Devuelve null si no es confiable. */
export function normalizar(raw: Partial<MovRow>, userId: string): MovRow | null {
  const id = String(raw?.id ?? '').trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null;

  const fecha = String(raw?.fecha ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;

  const tipo = raw?.tipo === 'ingreso' ? 'ingreso' : raw?.tipo === 'egreso' ? 'egreso' : null;
  if (!tipo) return null;

  const monto = Number(raw?.monto);
  if (!isFinite(monto) || monto <= 0 || monto > 1_000_000_000) return null;

  const ahora = new Date().toISOString();
  return {
    id,
    user_id: userId,
    fecha,
    tipo,
    categoria: (String(raw?.categoria ?? 'Otro').trim() || 'Otro').slice(0, 40),
    descripcion: String(raw?.descripcion ?? '').trim().slice(0, 120),
    monto: Math.round(monto * 100) / 100,
    metodo: String(raw?.metodo ?? '').trim().slice(0, 30),
    created_at: String(raw?.created_at ?? ahora).slice(0, 32),
    updated_at: String(raw?.updated_at ?? ahora).slice(0, 32),
    deleted: Number(raw?.deleted) === 1 ? 1 : 0
  };
}

/* ------------------------------ FILE ------------------------------ */
class FileMov implements MovStore {
  private carga(): MovRow[] {
    if (!existsSync(FILE)) return [];
    try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return []; }
  }
  private guarda(rows: MovRow[]): void {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(rows, null, 2), 'utf8');
  }
  async ensureSchema() { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); }
  async byUser(userId: string) { return this.carga().filter(r => r.user_id === userId); }

  async upsertMany(userId: string, incoming: Partial<MovRow>[]) {
    const rows = this.carga();
    let upserted = 0, skipped = 0;
    for (const raw of incoming) {
      const r = normalizar(raw, userId);
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
const HOJA = 'movimientos';
const COLUMNAS: (keyof MovRow)[] = [
  'id', 'user_id', 'fecha', 'tipo', 'categoria', 'descripcion', 'monto', 'metodo',
  'created_at', 'updated_at', 'deleted'
];
const ENCABEZADOS = COLUMNAS.map(String);
const ULTIMA = 'K';

class SheetsMov implements MovStore {
  async ensureSchema() { await sheetsEnsureSheet(HOJA, ENCABEZADOS); }

  private async filas(): Promise<{ row: MovRow; index: number }[]> {
    const values = await sheetsGetValues(`${HOJA}!A2:${ULTIMA}`);
    return values.map((r, i) => {
      const o: any = {};
      COLUMNAS.forEach((k, j) => { o[k] = r[j] ?? ''; });
      o.monto = Number(o.monto || 0);
      o.deleted = Number(o.deleted || 0);
      return { row: o as MovRow, index: i + 2 };
    });
  }

  async byUser(userId: string) {
    return (await this.filas()).filter(f => String(f.row.user_id) === userId).map(f => f.row);
  }

  async upsertMany(userId: string, incoming: Partial<MovRow>[]) {
    let skipped = 0;
    const validas: MovRow[] = [];
    for (const raw of incoming) {
      const r = normalizar(raw, userId);
      if (!r) { skipped++; continue; }
      validas.push(r);
    }
    if (!validas.length) return { upserted: 0, skipped };

    const filas = await this.filas();
    const nuevas: MovRow[] = [];
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

export function getMovStore(): MovStore {
  return driver() === 'sheets' ? new SheetsMov() : new FileMov();
}

/** Lo que el navegador recibe: números como números, sin nada interno. */
export function publicRow(r: MovRow) {
  return {
    id: r.id, fecha: r.fecha, tipo: r.tipo, categoria: r.categoria,
    descripcion: r.descripcion, monto: Number(r.monto), metodo: r.metodo,
    created_at: r.created_at, updated_at: r.updated_at, deleted: Number(r.deleted)
  };
}
