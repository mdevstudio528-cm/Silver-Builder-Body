/** Genera un hash scrypt listo para pegar en la columna `hash` del Excel. */
import './_env';
import { hashPassword, verifyPassword } from '../api/_lib/auth';

const pass = process.argv[2];
if (!pass) { console.error('Uso: npm run hash -- "MiPassword123"'); process.exit(1); }
const hash = hashPassword(pass);
console.log(hash);
console.log(`\nverificación: ${verifyPassword(pass, hash) ? '✓ correcta' : '✗ falló'}`);
