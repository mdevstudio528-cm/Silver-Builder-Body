"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizar = normalizar;
exports.getMovStore = getMovStore;
exports.publicRow = publicRow;
const fs_1 = require("fs");
const path_1 = require("path");
const sheets_1 = require("./sheets");
const DATA_DIR = process.env.DATA_DIR || (0, path_1.join)(process.cwd(), 'data');
const FILE = (0, path_1.join)(DATA_DIR, 'movimientos.json');
/** Valida y normaliza UNA fila que llega del cliente. Devuelve null si no es confiable. */
function normalizar(raw, userId) {
    const id = String(raw?.id ?? '').trim();
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id))
        return null;
    const fecha = String(raw?.fecha ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha))
        return null;
    const tipo = raw?.tipo === 'ingreso' ? 'ingreso' : raw?.tipo === 'egreso' ? 'egreso' : null;
    if (!tipo)
        return null;
    const monto = Number(raw?.monto);
    if (!isFinite(monto) || monto <= 0 || monto > 1_000_000_000)
        return null;
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
class FileMov {
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
            const r = normalizar(raw, userId);
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
const HOJA = 'movimientos';
const COLUMNAS = [
    'id', 'user_id', 'fecha', 'tipo', 'categoria', 'descripcion', 'monto', 'metodo',
    'created_at', 'updated_at', 'deleted'
];
const ENCABEZADOS = COLUMNAS.map(String);
const ULTIMA = 'K';
class SheetsMov {
    async ensureSchema() { await (0, sheets_1.sheetsEnsureSheet)(HOJA, ENCABEZADOS); }
    async filas() {
        const values = await (0, sheets_1.sheetsGetValues)(`${HOJA}!A2:${ULTIMA}`);
        return values.map((r, i) => {
            const o = {};
            COLUMNAS.forEach((k, j) => { o[k] = r[j] ?? ''; });
            o.monto = Number(o.monto || 0);
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
            const r = normalizar(raw, userId);
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
function getMovStore() {
    return driver() === 'sheets' ? new SheetsMov() : new FileMov();
}
/** Lo que el navegador recibe: números como números, sin nada interno. */
function publicRow(r) {
    return {
        id: r.id, fecha: r.fecha, tipo: r.tipo, categoria: r.categoria,
        descripcion: r.descripcion, monto: Number(r.monto), metodo: r.metodo,
        created_at: r.created_at, updated_at: r.updated_at, deleted: Number(r.deleted)
    };
}
