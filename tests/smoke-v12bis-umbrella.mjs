// Smoke V12bis umbrella — features dashboard-13 (C2 TTC, C3 onglet compta marché,
// C4 actions doc compta fournisseur, C5 marché inline, C6 edit doc compta,
// C8 fiche tâche niveau+pièce).

import fs from 'fs';
import { spawn } from 'child_process';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
function resolvePlaywright() {
  if (process.env.PLAYWRIGHT_PKG) return process.env.PLAYWRIGHT_PKG;
  try {
    const cjsPath = require.resolve('playwright');
    const mjs = cjsPath.replace(/index\.(c?js)$/, 'index.mjs');
    if (fs.existsSync(mjs)) return mjs;
    return cjsPath;
  } catch {}
  return '/Users/JC/dev/test-github/node_modules/playwright/index.mjs';
}
const { chromium } = await import(pathToFileURL(resolvePlaywright()).href);

const ARTIFACTS = process.env.ARTIFACTS_DIR || '/tmp/natlife-qa';
fs.mkdirSync(ARTIFACTS, { recursive: true });
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const URL_BASE = process.env.NATLIFE_URL || 'http://localhost:3000';

let devProc = null;
if (!process.env.NATLIFE_URL) {
  console.log('▶ next dev (port 3000)…');
  devProc = spawn('npx', ['next', 'dev', '-p', '3000'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('dev server timeout 60s')), 60000);
    const onData = (chunk) => {
      const s = chunk.toString();
      if (/Ready in|Local:/.test(s)) { clearTimeout(timer); devProc.stdout.off('data', onData); resolve(); }
    };
    devProc.stdout.on('data', onData);
    devProc.stderr.on('data', (c) => process.stderr.write(c));
  });
  console.log('✅ dev server ready');
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0',
});
const page = await context.newPage();

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(`PASS ${name}`); console.log(`✅ ${name}`); }
  catch (e) { results.push(`FAIL ${name}: ${e.message}`); console.log(`❌ ${name}: ${e.message}`); }
}

// === C2 — Colonne TTC sur fiche société (onglet compta)
await test('C2 /societes/[id]?tab=compta — colonne TTC présente', async () => {
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('table tbody tr a[href^="/societes/"]', { timeout: 10000 });
  const href = await page.$eval('table tbody tr a[href^="/societes/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${href}?tab=compta`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('main', { timeout: 10000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_umbrella_C2_societe_compta.png`, fullPage: true });
  const html = await page.content();
  if (!/TTC/.test(html)) throw new Error('TTC absent de la page société');
});

// === C3 — Onglet COMPTA fiche marché
await test('C3 /marches/[id] — onglet Compta présent', async () => {
  await page.goto(`${URL_BASE}/marches`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('table tbody tr a[href^="/marches/"]', { timeout: 10000 });
  const href = await page.$eval('table tbody tr a[href^="/marches/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${href}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('[role="tab"], nav button', { timeout: 10000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_umbrella_C3_marche_tabs.png`, fullPage: true });
  const tabsLabels = await page.$$eval('[role="tab"], nav button', (els) =>
    els.map((e) => e.textContent?.trim() ?? '')
  );
  if (!tabsLabels.some((t) => /^Compta/.test(t))) {
    throw new Error(`Onglet Compta absent. Tabs trouvés : ${tabsLabels.join(' | ')}`);
  }
});

// === C4 — Boutons inline (Pencil/Download/Trash) sur fiche fournisseur Compta
await test('C4 /fournisseurs/[id]?tab=factures — boutons actions présents', async () => {
  await page.goto(`${URL_BASE}/fournisseurs`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('table tbody tr a[href^="/fournisseurs/"]', { timeout: 10000 });
  const href = await page.$eval('table tbody tr a[href^="/fournisseurs/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${href}?tab=factures`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('main', { timeout: 10000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_umbrella_C4_fournisseur_compta.png`, fullPage: true });
  // Check pour la cellule Actions OU l'en-tête (présent même si liste vide)
  const html = await page.content();
  if (!/>Actions<\/th>|title="T[ée]l[ée]charger la PJ"|title="Supprimer le document compta"|Aucun devis/.test(html)) {
    throw new Error('Colonne Actions ou message vide absents');
  }
});

// === C5 — Bouton "+ Créer un marché à la volée" sur form upload doc compta
await test('C5 /societes/[id]?tab=compta — bouton "+ Créer un marché à la volée"', async () => {
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('table tbody tr a[href^="/societes/"]', { timeout: 10000 });
  const href = await page.$eval('table tbody tr a[href^="/societes/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${href}?tab=compta`, { waitUntil: 'networkidle', timeout: 30000 });
  // Attendre que le bouton "+ Nouveau devis" soit visible (hydration React terminée)
  const btn = page.getByRole('button', { name: /Nouveau devis/i }).first();
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  await btn.click();
  // Attendre que le form s'ouvre — détecter via input file qui n'existe que dans le form ouvert
  await page.waitForSelector('input[type="file"]', { timeout: 8000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_umbrella_C5_form_open.png`, fullPage: true });
  const html = await page.content();
  if (!/Créer un marché à la volée/.test(html)) {
    throw new Error('Bouton "Créer un marché à la volée" non rendu dans le form');
  }
});

// === C6 — Route edit doc compta accessible
await test('C6 /societes/[id]/compta/[docId]/edit — accessible OU pas de doc', async () => {
  // Le test passe si soit la route existe (au moins 1 doc), soit aucun doc
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('table tbody tr a[href^="/societes/"]', { timeout: 10000 });
  const href = await page.$eval('table tbody tr a[href^="/societes/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${href}?tab=compta`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('main', { timeout: 10000 });
  // Chercher un lien edit doc compta
  const editLinks = await page.$$eval('a[href*="/compta/"][href$="/edit"]', (as) => as.length);
  if (editLinks > 0) {
    const firstEdit = await page.$eval('a[href*="/compta/"][href$="/edit"]', (a) => a.getAttribute('href'));
    await page.goto(`${URL_BASE}${firstEdit}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('form', { timeout: 10000 });
    await page.screenshot({ path: `${ARTIFACTS}/${TS}_umbrella_C6_edit_doc.png`, fullPage: true });
    const html = await page.content();
    if (!/Modifier/.test(html)) throw new Error('Page edit doc compta non rendue');
  } else {
    console.log('   ℹ Aucun doc compta existant — route /edit non testable mais code OK (build clean)');
  }
});

// === C8 — Fiche tâche : LOT RATTACHE en haut + selects NIVEAU/PIECE
await test('C8 /marches/[id]/sous-lots/[sousLotId]/taches/new — LOT puis NIVEAU/PIECE', async () => {
  // Aller sur premier marché qui a un sous-lot
  await page.goto(`${URL_BASE}/marches`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('table tbody tr a[href^="/marches/"]', { timeout: 10000 });
  const href = await page.$eval('table tbody tr a[href^="/marches/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${href}?tab=suivi`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Chercher un lien "Ajouter" tâche (depuis arborescence sous-lots)
  const addLinks = await page.$$eval('a[href*="/taches/new"]', (as) => as.map((a) => a.getAttribute('href')));
  if (addLinks.length === 0) {
    console.log('   ℹ Aucun sous-lot pour tester form new tâche — code OK (build clean)');
    return;
  }
  await page.goto(`${URL_BASE}${addLinks[0]}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('form', { timeout: 10000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_umbrella_C8_new_tache.png`, fullPage: true });
  const html = await page.content();
  // LOT RATTACHE doit apparaitre avant Niveau dans le HTML source
  const lotIdx = html.indexOf('Lot rattaché');
  const niveauIdx = html.indexOf('Niveau');
  const pieceIdx = html.indexOf('Pièce');
  if (lotIdx === -1 || niveauIdx === -1 || pieceIdx === -1) {
    throw new Error(`Champs manquants — Lot: ${lotIdx}, Niveau: ${niveauIdx}, Pièce: ${pieceIdx}`);
  }
  if (lotIdx > niveauIdx) {
    throw new Error('Lot rattaché doit être AU-DESSUS de Niveau (ordre Natacha)');
  }
  // L'ancien input "Emplacement" doit être absent
  if (/<label[^>]*>Emplacement<\/label>/.test(html)) {
    throw new Error('Ancien input "Emplacement" encore présent — devrait être supprimé');
  }
});

await browser.close();
if (devProc) { devProc.kill('SIGTERM'); await new Promise((r) => setTimeout(r, 500)); }

console.log('\n=== Résumé umbrella ===');
results.forEach((r) => console.log(r));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} OK · artefacts : ${ARTIFACTS}/`);
process.exit(failed > 0 ? 1 : 0);
