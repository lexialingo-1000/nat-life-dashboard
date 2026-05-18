// Smoke V12bis PR6 — 3 fixes UX

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pwPath = (() => {
  const cjs = require.resolve('playwright');
  const mjs = cjs.replace(/index\.(c?js)$/, 'index.mjs');
  return fs.existsSync(mjs) ? mjs : cjs;
})();
const { chromium } = await import(pathToFileURL(pwPath).href);

const ARTIFACTS = '/tmp/natlife-qa';
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const URL_BASE = 'https://dashboard.fka-holding.com';
const STORAGE = path.join(ARTIFACTS, 'storage-state.json');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  storageState: STORAGE,
  userAgent: 'Mozilla/5.0',
});
const page = await context.newPage();

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(`PASS ${name}`); console.log(`✅ ${name}`); }
  catch (e) { results.push(`FAIL ${name}: ${e.message}`); console.log(`❌ ${name}: ${e.message}`); }
}

await page.goto(`${URL_BASE}/admin/parametres`, { waitUntil: 'domcontentloaded', timeout: 30000 });
if (page.url().includes('/login')) {
  console.log('❌ Session expirée — relancer smoke-prod-otp.mjs');
  process.exit(1);
}

// === Fix 1 : sidebar dropdown sous Paramètres
await test('Sidebar : 4 sous-items déployés sous Paramètres', async () => {
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_pr6_sidebar.png`, fullPage: true });
  const sidebarLinks = await page.$$eval('aside a[href^="/admin/"]', (as) =>
    as.map((a) => a.getAttribute('href'))
  );
  const expected = [
    '/admin/parametres',
    '/admin/types-documents',
    '/admin/document-categories',
    '/admin/marche-types',
    '/admin/supplier-types',
    '/admin/utilisateurs',
  ];
  const missing = expected.filter((h) => !sidebarLinks.includes(h));
  if (missing.length) throw new Error(`Sidebar links manquants : ${missing.join(', ')}. Trouvés : ${JSON.stringify(sidebarLinks)}`);
});

// === Fix 2 : BackLink sur /admin/marche-types
await test('BackLink "Paramètres" sur /admin/marche-types', async () => {
  await page.goto(`${URL_BASE}/admin/marche-types`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_pr6_marche_types.png`, fullPage: true });
  // BackLink composant rend un <a> ou <button> avec ArrowLeft + label
  const html = await page.content();
  if (!/Paramètres/i.test(html)) throw new Error('Pas de référence à "Paramètres" — BackLink absent');
  // Vérifie au moins un link vers /admin/parametres
  const links = await page.$$eval('a[href="/admin/parametres"]', (as) => as.length);
  if (links === 0) throw new Error('Aucun lien vers /admin/parametres');
});

// === Fix 3 : couleurs Type Société distinctes
await test('Liste Sociétés : commerciale=badge-blue, immobilière=badge-amber', async () => {
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_pr6_societes.png`, fullPage: true });
  // Trouve les badges Type dans la colonne 4 (Type)
  const badges = await page.$$eval('table tbody tr td:nth-of-type(4) span', (els) =>
    els.map((e) => ({ text: e.textContent.trim(), className: e.className }))
  );
  if (badges.length === 0) throw new Error('Aucun badge Type trouvé');
  const commerciale = badges.find((b) => b.text === 'Commerciale');
  const immobiliere = badges.find((b) => b.text === 'Immobilière');
  if (!commerciale || !immobiliere) throw new Error(`Badges manquants : ${JSON.stringify(badges.slice(0, 5))}`);
  if (commerciale.className === immobiliere.className) {
    throw new Error(`Mêmes classes : commerciale=${commerciale.className} immobiliere=${immobiliere.className}`);
  }
  if (!commerciale.className.includes('badge-blue')) {
    throw new Error(`Commerciale pas en badge-blue : ${commerciale.className}`);
  }
  if (!immobiliere.className.includes('badge-amber')) {
    throw new Error(`Immobilière pas en badge-amber : ${immobiliere.className}`);
  }
});

const pass = results.filter((r) => r.startsWith('PASS')).length;
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${pass} PASS / ${fail} FAIL`);
fs.writeFileSync(`${ARTIFACTS}/${TS}_pr6_report.txt`, results.join('\n'));
await browser.close();
process.exit(fail > 0 ? 1 : 0);
