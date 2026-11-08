"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizarMeta = normalizarMeta;
exports.getMetaStore = getMetaStore;
exports.publicMeta = publicMeta;
const fs_1 = require("fs");
const path_1 = require("path");
const sheets_1 = require("./sheets");
const DATA_DIR = process.env.DATA_DIR || (0, path_1.join)(process.cwd(), 'data');
const FILE = (0, path_1.join)(DATA_DIR, 'metas.json');
const PRIORIDADES = ['alta', 'media', 'baja'];
/** Valida y normaliza una meta que llega del navegador. */
function normalizarMeta(raw, userId) {
    const id = String(raw?.id ?? '').trim();
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id))
        return null;
    const nombre = String(raw?.nombre ?? '').trim().slice(0, 60);
    if (nombre.length < 1)
        return null;
    const objetivo = Number(raw?.monto_objetivo);
    if (!isFinite(objetivo) || objetivo <= 0 || objetivo > 1_000_000_000)
        return null;
    const actual = Number(raw?.monto_actual);
    if (!isFinite(actual) || actual < 0 || actual > 1_000_000_000)
        return null;
    const limite = String(raw?.fecha_limite ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(limite))
        return null;
    const aporte = Number(raw?.aporte_mensual ?? 0);
    if (!isFinite(aporte) || aporte < 0 || aporte > 1_000_000_000)
        return null;
    const ahora = new Date().toISOString();
    return {
        id,
        user_id: userId,
        nombre,
        monto_objetivo: Math.round(objetivo * 100) / 100,
        monto_actual: Math.round(actual * 100) / 100,
        fecha_limite: limite,
        prioridad: PRIORIDADES.includes(raw?.prioridad) ? raw.prioridad : 'media',
        aporte_mensual: Math.round(aporte * 100) / 100,
        created_at: String(raw?.created_at ?? ahora).slice(0, 32),
        updated_at: String(raw?.updated_at ?? ahora).slice(0, 32),
        deleted: Number(raw?.deleted) === 1 ? 1 : 0
    };
}
/* ------------------------------ FILE ------------------------------ */
class FileMetas {
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
    async byUser(userId) { return this.carga().filter(r => r.user_id === userId); }
    async upsertMany(userId, incoming) {
        const rows = this.carga();
        let upserted = 0, skipped = 0;
        for (const raw of incoming) {
            const r = normalizarMeta(raw, userId);
            if (!r) {
                skipped++;
                continue;
            }
            const i = rows.findIndex(x => x.id === r.id && x.user_id === userId);
            if (i < 0) {
                rows.push(r);
                upserted++;
                continue;
            }
            if (String(rows[i].updated_at) >= String(r.updated_at)) {
                skipped++;
                continue;
            }
            rows[i] = { ...rows[i], ...r };
            upserted++;
        }
        this.guarda(rows);
        return { upserted, skipped };
    }
}
/* ------------------------------ SHEETS ------------------------------ */
const HOJA = 'metas';
const COLUMNAS = [
    'id', 'user_id', 'nombre', 'monto_objetivo', 'monto_actual', 'fecha_limite',
    'prioridad', 'aporte_mensual', 'created_at', 'updated_at', 'deleted'
];
const ENCABEZADOS = COLUMNAS.map(String);
const ULTIMA = 'K';
class SheetsMetas {
    async ensureSchema() { await (0, sheets_1.sheetsEnsureSheet)(HOJA, ENCABEZADOS); }
    async filas() {
        const values = await (0, sheets_1.sheetsGetValues)(`${HOJA}!A2:${ULTIMA}`);
        return values.map((r, i) => {
            const o = {};
            COLUMNAS.forEach((k, j) => { o[k] = r[j] ?? ''; });
            o.monto_objetivo = Number(o.monto_objetivo || 0);
            o.monto_actual = Number(o.monto_actual || 0);
            o.aporte_mensual = Number(o.aporte_mensual || 0);
            o.deleted = Number(o.deleted || 0);
            return { row: o, index: i + 2 };
        });
    }
    async byUser(userId) {
        return (await this.filas()).filter(f => String(f.row.user_id) === userId).map(f => f.row);
    }
    async upsertMany(userId, incoming) {
        let skipped = 0;
        const validas = [];
        for (const raw of incoming) {
            const r = normalizarMeta(raw, userId);
            if (!r) {
                skipped++;
                continue;
            }
            validas.push(r);
        }
        if (!validas.length)
            return { upserted: 0, skipped };
        const filas = await this.filas();
        const nuevas = [];
        const cambios = [];
        let upserted = 0;
        for (const r of validas) {
            const f = filas.find(x => String(x.row.id) === r.id && String(x.row.user_id) === userId);
            if (!f) {
                nuevas.push(r);
                upserted++;
                continue;
            }
            if (String(f.row.updated_at) >= String(r.updated_at)) {
                skipped++;
                continue;
            }
            cambios.push({
                range: `${HOJA}!A${f.index}:${ULTIMA}${f.index}`,
                values: [COLUMNAS.map(k => (r[k] ?? ''))]
            });
            upserted++;
        }
        if (nuevas.length)
            await (0, sheets_1.sheetsAppendRows)(HOJA, nuevas.map(r => COLUMNAS.map(k => (r[k] ?? ''))));
        if (cambios.length)
            await (0, sheets_1.sheetsBatchUpdate)(cambios);
        return { upserted, skipped };
    }
}
const driver = () => String(process.env.SHEETS_DRIVER || 'file').toLowerCase();
function getMetaStore() {
    return driver() === 'sheets' ? new SheetsMetas() : new FileMetas();
}
function publicMeta(r) {
    return {
        id: r.id, nombre: r.nombre,
        monto_objetivo: Number(r.monto_objetivo), monto_actual: Number(r.monto_actual),
        fecha_limite: r.fecha_limite, prioridad: r.prioridad,
        aporte_mensual: Number(r.aporte_mensual),
        created_at: r.created_at, updated_at: r.updated_at, deleted: Number(r.deleted)
    };
}
