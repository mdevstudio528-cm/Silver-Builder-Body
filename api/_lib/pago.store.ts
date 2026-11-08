/**
 * Almacén de pagos (mensualidades cobradas).
 *   - 'file'   → data/pagos.json
 *   - 'sheets' → pestaña "pagos" de la hoja privada
 *
 * Solo el administrador escribe aquí. No hay sincronización offline: un pago
 * se registra en línea. Anular es un borrado lógico (deleted = 1) para no
 * perder el rastro de lo que se cobró.
 */
import type { PagoRow, MetodoPago } from './pago.types';
import { METODOS } from './pago.types';
import { fechaValida } from './fechas';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { sheetsGetValues, sheetsAppendRow, sheetsUpdateRow, sheetsEnsureSheet } from './sheets';

export interface PagoStore {
  ensureSchema(): Promise<void>;
  listAll(): Promise<PagoRow[]>;
  byUser(userId: string): Promise<PagoRow[]>;
  insert(row: PagoRow): Promise<void>;
  update(id: string, patch: Partial<PagoRow>): Promise<void>;
}

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'pagos.json');

/** Valida y normaliza un pago que llega del panel. userId lo pone el servidor. */
export function normalizarPago(raw: Partial<PagoRow>, userId: string): PagoRow | null {
  const id = String(raw?.id ?? '').trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null;
  if (!userId) return null;

  if (!fechaValida(String(raw?.fecha_pago ?? ''))) return null;
  if (!fechaValida(String(raw?.periodo_desde ?? ''))) return null;
  if (!fechaValida(String(raw?.periodo_hasta ?? ''))) return null;

  const monto = Number(raw?.monto);
  if (!isFinite(monto) || monto <= 0 || monto > 1_000_000_000) return null;

  const meses = Math.trunc(Number(raw?.meses ?? 1));
  if (!isFinite(meses) || meses < 1 || meses > 60) return null;

  const metodo = String(raw?.metodo ?? 'efectivo').toLowerCase();
  const ahora = new Date().toISOString();

  return {
    id,
    user_id: userId,
    fecha_pago: String(raw!.fecha_pago),
    monto: Math.round(monto * 100) / 100,
    metodo: (METODOS as readonly string[]).includes(metodo) ? (metodo as MetodoPago) : 'otro',
    meses,
    periodo_desde: String(raw!.periodo_desde),
    periodo_hasta: String(raw!.periodo_hasta),
    notas: String(raw?.notas ?? '').trim().slice(0, 160),
    created_at: String(raw?.created_at ?? ahora).slice(0, 32),
    updated_at: String(raw?.updated_at ?? ahora).slice(0, 32),
    deleted: Number(raw?.deleted) === 1 ? 1 : 0
  };
}

/* ------------------------------ FILE ------------------------------ */
class FilePagos implements PagoStore {
  private carga(): PagoRow[] {
    if (!existsSync(FILE)) return [];
    try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return []; }
  }
  private guarda(rows: PagoRow[]): void {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(rows, null, 2), 'utf8');
  }
  async ensureSchema() { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); }
  async listAll() { return this.carga(); }
  async byUser(userId: string) { return this.carga().filter(r => r.user_id === userId); }
  async insert(row: PagoRow) { const rows = this.carga(); rows.push(row); this.guarda(rows); }
  async update(id: string, patch: Partial<PagoRow>) {
    const rows = this.carga();
    const i = rows.findIndex(r => r.id === id);
    if (i < 0) return;
    rows[i] = { ...rows[i], ...patch };
    this.guarda(rows);
  }
}

/* ------------------------------ SHEETS ------------------------------ */
const HOJA = 'pagos';
const COLUMNAS: (keyof PagoRow)[] = [
  'id', 'user_id', 'fecha_pago', 'monto', 'metodo', 'meses',
  'periodo_desde', 'periodo_hasta', 'notas', 'created_at', 'updated_at', 'deleted'
];
const ENCABEZADOS = COLUMNAS.map(String);
const ULTIMA = 'L';

class SheetsPagos implements PagoStore {
  async ensureSchema() { await sheetsEnsureSheet(HOJA, ENCABEZADOS); }

  private async filas(): Promise<{ row: PagoRow; index: number }[]> {
    const values = await sheetsGetValues(`${HOJA}!A2:${ULTIMA}`);
    return values.map((r, i) => {
      const o: any = {};
      COLUMNAS.forEach((k, j) => { o[k] = r[j] ?? ''; });
      o.monto = Number(o.monto || 0);
      o.meses = Number(o.meses || 1);
      o.deleted = Number(o.deleted || 0);
      return { row: o as PagoRow, index: i + 2 };
    });
  }

  async listAll() { return (await this.filas()).map(f => f.row); }
  async byUser(userId: string) {
    return (await this.filas()).filter(f => String(f.row.user_id) === userId).map(f => f.row);
  }
  async insert(row: PagoRow) {
    await sheetsAppendRow(HOJA, COLUMNAS.map(k => ((row as any)[k] ?? '') as string | number));
  }
  async update(id: string, patch: Partial<PagoRow>) {
    const found = (await this.filas()).find(f => String(f.row.id) === id);
    if (!found) return;
    const merged = { ...found.row, ...patch };
    await sheetsUpdateRow(
      `${HOJA}!A${found.index}:${ULTIMA}${found.index}`,
      COLUMNAS.map(k => ((merged as any)[k] ?? '') as string | number)
    );
  }
}

const driver = () => String(process.env.SHEETS_DRIVER || 'file').toLowerCase();

export function getPagoStore(): PagoStore {
  return driver() === 'sheets' ? new SheetsPagos() : new FilePagos();
}

/** Lo que el navegador ve: números como números. */
export function publicPago(p: PagoRow) {
  return {
    id: p.id,
    user_id: p.user_id,
    fecha_pago: p.fecha_pago,
    monto: Number(p.monto),
    metodo: p.metodo,
    meses: Number(p.meses),
    periodo_desde: p.periodo_desde,
    periodo_hasta: p.periodo_hasta,
    notas: p.notas,
    created_at: p.created_at,
    deleted: Number(p.deleted)
  };
}
