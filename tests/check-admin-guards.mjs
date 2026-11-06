// Contrôle des rôles : toute server action de suppression (delete*) et toute action des
// Paramètres (app/(dashboard)/admin/**) doit commencer par `await requireAdmin();`.
// Masquer un bouton ne protège rien : une server action s'appelle directement en POST.
// Usage : node tests/check-admin-guards.mjs [dossier src]   (code ≠ 0 = garde manquante)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[2] ?? fileURLToPath(new URL('../src', import.meta.url));
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f)) files.push(p);
  }
};
walk(root);

const missing = [];
let checked = 0;
for (const p of files) {
  const s = readFileSync(p, 'utf8');
  if (!/^\s*['"]use server['"]/.test(s)) continue;
  const admin = p.includes('/admin/');
  for (const m of s.matchAll(/^export async function (\w+)\((?:[^()]|\([^()]*\))*\)[^\n]*\{\n([^\n]*)/gm)) {
    const [, name, firstLine] = m;
    if (!admin && !name.startsWith('delete')) continue;
    checked++;
    if (firstLine.trim() !== 'await requireAdmin();') missing.push(`${p.slice(root.length + 1)} : ${name}`);
  }
}
if (missing.length) {
  console.error(`[ROLES-01] ${missing.length} action(s) sans requireAdmin() :\n  ` + missing.join('\n  '));
  process.exit(1);
}
if (checked === 0) {
  console.error('[ROLES-02] aucune action trouvée : le contrôle ne voit plus rien (chemin ? format ?)');
  process.exit(1);
}
console.log(`ok : ${checked} actions réservées aux admins, toutes gardées`);
