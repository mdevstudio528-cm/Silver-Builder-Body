"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizarPago = normalizarPago;
exports.getPagoStore = getPagoStore;
exports.publicPago = publicPago;
const pago_types_1 = require("./pago.types");
const fechas_1 = require("./fechas");
const fs_1 = require("fs");
const path_1 = require("path");
const sheets_1 = require("./sheets");
const DATA_DIR = process.env.DATA_DIR || (0, path_1.join)(process.cwd(), 'data');
const FILE = (0, path_1.join)(DATA_DIR, 'pagos.json');
/** Valida y normaliza un pago que llega del panel. userId lo pone el servidor. */
function normalizarPago(raw, userId) {
    const id = String(raw?.id ?? '').trim();
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id))
        return null;
    if (!userId)
        return null;
    if (!(0, fechas_1.fechaValida)(String(raw?.fecha_pago ?? '')))
        return null;
    if (!(0, fechas_1.fechaValida)(String(raw?.periodo_desde ?? '')))
        return null;
    if (!(0, fechas_1.fechaValida)(String(raw?.periodo_hasta ?? '')))
        return null;
    const monto = Number(raw?.monto);
    if (!isFinite(monto) || monto <= 0 || monto > 1_000_000_000)
        return null;
    const meses = Math.trunc(Number(raw?.meses ?? 1));
    if (!isFinite(meses) || meses < 1 || meses > 60)
        return null;
    const metodo = String(raw?.metodo ?? 'efectivo').toLowerCase();
    const ahora = new Date().toISOString();
    return {
        id,
        user_id: userId,
        fecha_pago: String(raw.fecha_pago),
        monto: Math.round(monto * 100) / 100,
        metodo: pago_types_1.METODOS.includes(metodo) ? metodo : 'otro',
        meses,
        periodo_desde: String(raw.periodo_desde),
        periodo_hasta: String(raw.periodo_hasta),
        notas: String(raw?.notas ?? '').trim().slice(0, 160),
        created_at: String(raw?.created_at ?? ahora).slice(0, 32),
        updated_at: String(raw?.updated_at ?? ahora).slice(0, 32),
        deleted: Number(raw?.deleted) === 1 ? 1 : 0
    };
}
/* ------------------------------ FILE ------------------------------ */
class FilePagos {
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
    async listAll() { return this.carga(); }
    async byUser(userId) { return this.carga().filter(r => r.user_id === userId); }
    async insert(row) { const rows = this.carga(); rows.push(row); this.guarda(rows); }
    async update(id, patch) {
        const rows = this.carga();
        const i = rows.findIndex(r => r.id === id);
        if (i < 0)
            return;
        rows[i] = { ...rows[i], ...patch };
        this.guarda(rows);
    }
}
/* ------------------------------ SHEETS ------------------------------ */
const HOJA = 'pagos';
const COLUMNAS = [
    'id', 'user_id', 'fecha_pago', 'monto', 'metodo', 'meses',
    'periodo_desde', 'periodo_hasta', 'notas', 'created_at', 'updated_at', 'deleted'
];
const ENCABEZADOS = COLUMNAS.map(String);
const ULTIMA = 'L';
class SheetsPagos {
    async ensureSchema() { await (0, sheets_1.sheetsEnsureSheet)(HOJA, ENCABEZADOS); }
    async filas() {
        const values = await (0, sheets_1.sheetsGetValues)(`${HOJA}!A2:${ULTIMA}`);
        return values.map((r, i) => {
            const o = {};
            COLUMNAS.forEach((k, j) => { o[k] = r[j] ?? ''; });
            o.monto = Number(o.monto || 0);
            o.meses = Number(o.meses || 1);
            o.deleted = Number(o.deleted || 0);
            return { row: o, index: i + 2 };
        });
    }
    async listAll() { return (await this.filas()).map(f => f.row); }
    async byUser(userId) {
        return (await this.filas()).filter(f => String(f.row.user_id) === userId).map(f => f.row);
    }
    async insert(row) {
        await (0, sheets_1.sheetsAppendRow)(HOJA, COLUMNAS.map(k => (row[k] ?? '')));
    }
    async update(id, patch) {
        const found = (await this.filas()).find(f => String(f.row.id) === id);
        if (!found)
            return;
        const merged = { ...found.row, ...patch };
        await (0, sheets_1.sheetsUpdateRow)(`${HOJA}!A${found.index}:${ULTIMA}${found.index}`, COLUMNAS.map(k => (merged[k] ?? '')));
    }
}
const driver = () => String(process.env.SHEETS_DRIVER || 'file').toLowerCase();
function getPagoStore() {
    return driver() === 'sheets' ? new SheetsPagos() : new FilePagos();
}
/** Lo que el navegador ve: números como números. */
function publicPago(p) {
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
