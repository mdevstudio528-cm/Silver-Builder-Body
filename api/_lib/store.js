"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLUMNAS = void 0;
exports.getStore = getStore;
exports.driverActual = driverActual;
const fs_1 = require("fs");
const path_1 = require("path");
/* ------------------------------ FILE ------------------------------ */
const DATA_DIR = process.env.DATA_DIR || (0, path_1.join)(process.cwd(), 'data');
const FILE = (0, path_1.join)(DATA_DIR, 'users.json');
class FileStore {
    carga() {
        if (!(0, fs_1.existsSync)(FILE))
            return [];
        try {
            return JSON.parse((0, fs_1.readFileSync)(FILE, 'utf8'));
        }
        catch {
            return [];
        }
    }
    guarda(rows) {
        if (!(0, fs_1.existsSync)(DATA_DIR))
            (0, fs_1.mkdirSync)(DATA_DIR, { recursive: true });
        (0, fs_1.writeFileSync)(FILE, JSON.stringify(rows, null, 2), 'utf8');
    }
    async ensureSchema() { if (!(0, fs_1.existsSync)(DATA_DIR))
        (0, fs_1.mkdirSync)(DATA_DIR, { recursive: true }); }
    async listUsers() { return this.carga(); }
    async findById(id) { return this.carga().find(u => u.id === id) ?? null; }
    async findByEmail(correo) {
        const c = String(correo || '').trim().toLowerCase();
        return this.carga().find(u => u.correo.toLowerCase() === c) ?? null;
    }
    async insert(row) { const rows = this.carga(); rows.push(row); this.guarda(rows); }
    async update(id, patch) {
        const rows = this.carga();
        const i = rows.findIndex(u => u.id === id);
        if (i < 0)
            return;
        rows[i] = { ...rows[i], ...patch };
        this.guarda(rows);
    }
}
/* ------------------------------ SHEETS ------------------------------ */
const sheets_1 = require("./sheets");
const HOJA = 'usuarios';
exports.COLUMNAS = [
    'id', 'nombre', 'ap_paterno', 'ap_materno', 'telefono', 'correo', 'hash', 'estatus', 'rol',
    'fecha_alta', 'ultimo_acceso', 'debe_cambiar_pass', 'session_version', 'intentos_fallidos', 'bloqueado_hasta'
];
const ENCABEZADOS = exports.COLUMNAS.map(String);
class SheetsStore {
    cache = null;
    TTL = 10_000;
    async ensureSchema() { await (0, sheets_1.sheetsEnsureSheet)(HOJA, ENCABEZADOS); }
    async filas() {
        const values = await (0, sheets_1.sheetsGetValues)(`${HOJA}!A2:O`);
        return values.map((r, i) => {
            const obj = {};
            exports.COLUMNAS.forEach((k, j) => { obj[k] = r[j] ?? ''; });
            obj.session_version = Number(obj.session_version || 1);
            obj.intentos_fallidos = Number(obj.intentos_fallidos || 0);
            obj.debe_cambiar_pass = Number(obj.debe_cambiar_pass || 0);
            return { row: obj, index: i + 2 };
        });
    }
    async todas(force = false) {
        if (!force && this.cache && Date.now() - this.cache.at < this.TTL) {
            return this.cache.rows.map((row) => ({ row, index: -1 }));
        }
        const filas = await this.filas();
        this.cache = { rows: filas.map(f => f.row), at: Date.now() };
        return filas;
    }
    async listUsers() { return (await this.todas(true)).map(f => f.row); }
    async findById(id) { return (await this.filas()).find(f => f.row.id === id)?.row ?? null; }
    async findByEmail(correo) {
        const c = String(correo || '').trim().toLowerCase();
        return (await this.filas()).find(f => String(f.row.correo).toLowerCase() === c)?.row ?? null;
    }
    async insert(row) {
        await (0, sheets_1.sheetsAppendRow)(HOJA, exports.COLUMNAS.map(k => String(row[k] ?? '')));
        this.cache = null;
    }
    async update(id, patch) {
        const todas = await this.filas();
        const found = todas.find(f => f.row.id === id);
        if (!found)
            return;
        const merged = { ...found.row, ...patch };
        await (0, sheets_1.sheetsUpdateRow)(`${HOJA}!A${found.index}:O${found.index}`, exports.COLUMNAS.map(k => String(merged[k] ?? '')));
        this.cache = null;
    }
}
const driver = () => String(process.env.SHEETS_DRIVER || 'file').toLowerCase();
function getStore() {
    return driver() === 'sheets' ? new SheetsStore() : new FileStore();
}
function driverActual() {
    return driver() === 'sheets' ? 'sheets' : 'file';
}
