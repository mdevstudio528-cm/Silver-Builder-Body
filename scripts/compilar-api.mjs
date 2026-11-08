/**
 * Compila api/**\/*.ts -> api/**\/*.js en CommonJS (lo que ejecuta Vercel).
 * Uso:  npm run build:api
 * Los .ts se quedan como fuente (los usan los scripts y dev:api); los .js son los que se despliegan.
 */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const API = path.join(ROOT, 'api');
const entries = [];
const libs = [];

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.ts')) {
      const rel = path.relative(API, p);
      (rel.split(path.sep)[0] === '_lib' ? libs : entries).push(p);
    }
  }
}
walk(API);

function convert(src, isEntry) {
  let out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      isolatedModules: true,
      removeComments: false
    }
  }).outputText;
  if (isEntry) {
    out +=
      "\n/* Vercel / Node: el runtime invoca module.exports directamente, no .default */\n" +
      "if (module.exports && typeof module.exports.default === 'function') module.exports = module.exports.default;\n";
  }
  return out;
}

let n = 0;
for (const [list, isEntry] of [[libs, false], [entries, true]]) {
  for (const p of list) {
    const dest = path.join(API, path.relative(API, p).replace(/\.ts$/, '.js'));
    fs.writeFileSync(dest, convert(fs.readFileSync(p, 'utf8'), isEntry), 'utf8');
    n++;
    if (isEntry) console.log('  función CJS →', path.relative(ROOT, dest));
  }
}
console.log(`\nOK: ${n} archivos .js en CommonJS (${entries.length} funciones + ${libs.length} módulos de _lib)`);
if (entries.length > 12) {
  console.error(`AVISO: ${entries.length} funciones; el plan Hobby de Vercel solo admite 12.`);
  process.exit(1);
}
