/**
 * Capa de almacenamiento. Dos drivers con la misma interfaz:
 *   - 'file'   → data/users.json (desarrollo, cero credenciales)
 *   - 'sheets' → Google Sheets privado (producción)
 * Cambiar de uno a otro es una variable de entorno; el resto del código no se entera.
 */
import type { UserRow } from './users.types';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface Store {
  ensureSchema(): Promise<void>;
  listUsers(): Promise<UserRow[]>;
  findById(id: string): Promise<UserRow | null>;
  findByEmail(correo: string): Promise<UserRow | null>;
  insert(row: UserRow): Promise<void>;
  update(id: string, patch: Partial<UserRow>): Promise<void>;
}

/* ------------------------------ FILE ------------------------------ */
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'users.json');

class FileStore implements Store {
  private carga(): UserRow[] {
    if (!existsSync(FILE)) return [];
    try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return []; }
  }
  private guarda(rows: UserRow[]): void {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(rows, null, 2), 'utf8');
  }
  async ensureSchema() { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); }
  async listUsers() { return this.carga(); }
  async findById(id: string) { return this.carga().find(u => u.id === id) ?? null; }
  async findByEmail(correo: string) {
    const c = String(correo || '').trim().toLowerCase();
    return this.carga().find(u => u.correo.toLowerCase() === c) ?? null;
  }
  async insert(row: UserRow) { const rows = this.carga(); rows.push(row); this.guarda(rows); }
  async update(id: string, patch: Partial<UserRow>) {
    const rows = this.carga();
    const i = rows.findIndex(u => u.id === id);
    if (i < 0) return;
    rows[i] = { ...rows[i], ...patch };
    this.guarda(rows);
  }
}

/* ------------------------------ SHEETS ------------------------------ */
import { sheetsGetValues, sheetsAppendRow, sheetsUpdateRow, sheetsEnsureSheet } from './sheets';

const HOJA = 'usuarios';
export const COLUMNAS: (keyof UserRow)[] = [
  'id', 'nombre', 'ap_paterno', 'ap_materno', 'telefono', 'correo', 'hash', 'estatus', 'rol',
  'fecha_alta', 'ultimo_acceso', 'debe_cambiar_pass', 'session_version', 'intentos_fallidos', 'bloqueado_hasta'
];
const ENCABEZADOS = COLUMNAS.map(String);

class SheetsStore implements Store {
  private cache: { rows: UserRow[]; at: number } | null = null;
  private TTL = 10_000;

  async ensureSchema() { await sheetsEnsureSheet(HOJA, ENCABEZADOS); }

  private async filas(): Promise<{ row: UserRow; index: number }[]> {
    const values = await sheetsGetValues(`${HOJA}!A2:O`);
    return values.map((r, i) => {
      const obj: any = {};
      COLUMNAS.forEach((k, j) => { obj[k] = r[j] ?? ''; });
      obj.session_version = Number(obj.session_version || 1);
      obj.intentos_fallidos = Number(obj.intentos_fallidos || 0);
      obj.debe_cambiar_pass = Number(obj.debe_cambiar_pass || 0);
      return { row: obj as UserRow, index: i + 2 };
    });
  }

  private async todas(force = false): Promise<{ row: UserRow; index: number }[]> {
    if (!force && this.cache && Date.now() - this.cache.at < this.TTL) {
      return (this.cache.rows as any).map((row: UserRow) => ({ row, index: -1 }));
    }
    const filas = await this.filas();
    this.cache = { rows: filas.map(f => f.row), at: Date.now() };
    return filas;
  }

  async listUsers() { return (await this.todas(true)).map(f => f.row); }
  async findById(id: string) { return (await this.filas()).find(f => f.row.id === id)?.row ?? null; }
  async findByEmail(correo: string) {
    const c = String(correo || '').trim().toLowerCase();
    return (await this.filas()).find(f => String(f.row.correo).toLowerCase() === c)?.row ?? null;
  }

  async insert(row: UserRow) {
    await sheetsAppendRow(HOJA, COLUMNAS.map(k => String((row as any)[k] ?? '')));
    this.cache = null;
  }

  async update(id: string, patch: Partial<UserRow>) {
    const todas = await this.filas();
    const found = todas.find(f => f.row.id === id);
    if (!found) return;
    const merged = { ...found.row, ...patch };
    await sheetsUpdateRow(`${HOJA}!A${found.index}:O${found.index}`, COLUMNAS.map(k => String((merged as any)[k] ?? '')));
    this.cache = null;
  }
}

const driver = () => String(process.env.SHEETS_DRIVER || 'file').toLowerCase();

export function getStore(): Store {
  return driver() === 'sheets' ? new SheetsStore() : new FileStore();
}

export function driverActual(): 'file' | 'sheets' {
  return driver() === 'sheets' ? 'sheets' : 'file';
}
