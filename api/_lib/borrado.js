"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.borrarUsuarioCompleto = borrarUsuarioCompleto;
/**
 * Borrado DEFINITIVO de un usuario y de todo lo suyo.
 *
 * Qué elimina:
 *   usuarios      → su fila (ya no puede entrar; el correo queda libre)
 *   movimientos   → todos sus ingresos y egresos (incluidos los marcados deleted)
 *   metas         → todas sus metas y abonos
 *   pagos         → su historial de cobros
 *
 * En Sheets se borran las FILAS de verdad (deleteDimension), no se marca
 * deleted = 1: el usuario pidió que desaparezca "con todo y sus movimientos".
 * El orden es descendente para que los índices no se corran.
 */
const fs_1 = require("fs");
const path_1 = require("path");
const store_1 = require("./store");
const sheets_1 = require("./sheets");
const driver = () => String(process.env.SHEETS_DRIVER || 'file').toLowerCase();
const DATA_DIR = process.env.DATA_DIR || (0, path_1.join)(process.cwd(), 'data');
const TABLAS = [
    { hoja: 'movimientos', archivo: 'movimientos.json', col: 1, ultima: 'K' }, // user_id = col B
    { hoja: 'metas', archivo: 'metas.json', col: 1, ultima: 'K' }, // user_id = col B
    { hoja: 'pagos', archivo: 'pagos.json', col: 1, ultima: 'L' } // user_id = col B
];
/* ------------------------------ FILE ------------------------------ */
function borrarEnArchivo(t, userId) {
    const ruta = (0, path_1.join)(DATA_DIR, t.archivo);
    if (!(0, fs_1.existsSync)(ruta))
        return 0;
    let rows = [];
    try {
        rows = JSON.parse((0, fs_1.readFileSync)(ruta, 'utf8'));
    }
    catch {
        return 0;
    }
    const antes = rows.length;
    const quedan = rows.filter(r => String(r?.user_id ?? '') !== userId);
    if (quedan.length !== antes)
        (0, fs_1.writeFileSync)(ruta, JSON.stringify(quedan, null, 2), 'utf8');
    return antes - quedan.length;
}
function borrarUsuarioArchivo(userId) {
    const ruta = (0, path_1.join)(DATA_DIR, 'users.json');
    if (!(0, fs_1.existsSync)(ruta))
        return false;
    let rows = [];
    try {
        rows = JSON.parse((0, fs_1.readFileSync)(ruta, 'utf8'));
    }
    catch {
        return false;
    }
    const antes = rows.length;
    const quedan = rows.filter(r => String(r?.id ?? '') !== userId);
    if (quedan.length !== antes)
        (0, fs_1.writeFileSync)(ruta, JSON.stringify(quedan, null, 2), 'utf8');
    return quedan.length !== antes;
}
/* ---------------------------- EJECUTAR ---------------------------- */
async function borrarUsuarioCompleto(userId) {
    const res = { usuario: false, movimientos: 0, metas: 0, pagos: 0, detalle: [] };
    if (driver() === 'sheets') {
        for (const t of TABLAS) {
            const valores = await (0, sheets_1.sheetsGetValues)(`${t.hoja}!A2:${t.ultima}`);
            // índice 0 del arreglo = fila 2 de la hoja
            const filas = [];
            valores.forEach((r, i) => { if (String(r?.[t.col] ?? '') === userId)
                filas.push(i + 2); });
            const borradas = await (0, sheets_1.sheetsDeleteRows)(t.hoja, filas);
            if (t.hoja === 'movimientos')
                res.movimientos = borradas;
            if (t.hoja === 'metas')
                res.metas = borradas;
            if (t.hoja === 'pagos')
                res.pagos = borradas;
            res.detalle.push(`${t.hoja}: ${borradas} fila(s) eliminada(s)`);
        }
        const users = await (0, sheets_1.sheetsGetValues)('usuarios!A2:O');
        const filasUser = users.map((r, i) => (String(r?.[0] ?? '') === userId ? i + 2 : 0)).filter(n => n > 0);
        const borrado = await (0, sheets_1.sheetsDeleteRows)('usuarios', filasUser);
        res.usuario = borrado > 0;
        res.detalle.push(`usuarios: ${borrado} fila(s) eliminada(s)`);
        return res;
    }
    for (const t of TABLAS) {
        const n = borrarEnArchivo(t, userId);
        if (t.hoja === 'movimientos')
            res.movimientos = n;
        if (t.hoja === 'metas')
            res.metas = n;
        if (t.hoja === 'pagos')
            res.pagos = n;
        res.detalle.push(`${t.hoja}: ${n} fila(s) eliminada(s)`);
    }
    res.usuario = borrarUsuarioArchivo(userId);
    res.detalle.push(`usuarios: ${res.usuario ? 'eliminado' : 'no estaba en el archivo'}`);
    // se toca el store para que no quede caché en memoria
    await (0, store_1.getStore)().listUsers();
    return res;
}
