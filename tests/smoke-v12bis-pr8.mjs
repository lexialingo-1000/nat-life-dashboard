// Smoke V12bis PR8 — quick-wins UI (§1 colonne siège, §8 onglet Compta, §9 titre Location)
// Lance dev server localhost:3000 (DEV_BYPASS_AUTH=true). Vérifie 3 changements UI.

import fs from 'fs';
import path from 'path';
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

// Démarre dev server si pas de URL custom
let devProc = null;
if (!process.env.NATLIFE_URL) {
  console.log('▶ Lancement next dev (port 3000)…');
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
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36',
});
const page = await context.newPage();

const results = [];
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

async function test(name, fn) {
  try { await fn(); results.push(`PASS ${name}`); console.log(`✅ ${name}`); }
  catch (e) { results.push(`FAIL ${name}: ${e.message}`); console.log(`❌ ${name}: ${e.message}`); }
}

// === §1 Liste Sociétés : pas de colonne "Siège"
await test('§1 /societes — colonne Siège absente', async () => {
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('table thead th', { timeout: 10000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_pr8_societes.png`, fullPage: true });
  const headers = await page.$$eval('table thead th', (ths) =>
    ths.map((th) => th.textContent?.trim() ?? '')
  );
  if (headers.some((h) => /si[èe]ge/i.test(h))) {
    throw new Error(`Colonne Siège encore présente : ${JSON.stringify(headers)}`);
  }
});

// === §8 Fiche Client : onglet "Compta" (et pas "Factures")
await test('§8 /clients/[id] — onglet Compta présent, Factures absent', async () => {
  await page.goto(`${URL_BASE}/clients`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('table tbody tr a', { timeout: 10000 });
  const firstClientHref = await page.$eval('table tbody tr a[href^="/clients/"]', (a) => a.getAttribute('href'));
  if (!firstClientHref) throw new Error('Aucun client trouvé');
  await page.goto(`${URL_BASE}${firstClientHref}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('[role="tab"], button[role="tab"], nav button', { timeout: 10000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_pr8_client_tabs.png`, fullPage: true });
  const tabLabels = await page.$$eval('[role="tab"], nav button', (els) =>
    els.map((e) => e.textContent?.trim() ?? '')
  );
  const joined = tabLabels.join(' | ');
  if (!/Compta/.test(joined)) throw new Error(`Onglet Compta absent. Trouvés : ${joined}`);
  if (/^Factures$|\|Factures\||\| Factures$/.test(joined)) {
    throw new Error(`Onglet Factures encore présent : ${joined}`);
  }
});

// === §9 Fiche Location : titre = bien · lot · dates au-dessus, locataire en-dessous
await test('§9 /locations/[id] — titre H1 contient bien+lot+date, locataire en-dessous', async () => {
  await page.goto(`${URL_BASE}/locations`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('table tbody tr a', { timeout: 10000 });
  const firstLocHref = await page.$eval('table tbody tr a[href^="/locations/"]', (a) => a.getAttribute('href'));
  if (!firstLocHref) throw new Error('Aucune location trouvée');
  await page.goto(`${URL_BASE}${firstLocHref}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('h1', { timeout: 10000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_pr8_location_header.png`, fullPage: true });
  const h1Text = (await page.$eval('h1', (h) => h.textContent ?? '')).trim();
  // H1 doit contenir une date (format JJ/MM/YYYY ou similaire) et au moins un séparateur ·
  if (!/\d{2}\/\d{2}\/\d{4}|\d{4}/.test(h1Text)) {
    throw new Error(`H1 ne contient pas de date : "${h1Text}"`);
  }
  if (!/·/.test(h1Text)) {
    throw new Error(`H1 ne contient pas le séparateur · : "${h1Text}"`);
  }
  // Locataire doit être en-dessous (paragraphe contenant "Locataire")
  const tenantBlock = await page.$$eval('header p', (ps) =>
    ps.map((p) => p.textContent?.trim() ?? '').join(' | ')
  );
  if (!/Locataire/i.test(tenantBlock)) {
    throw new Error(`Bloc "Locataire :" introuvable sous le H1. Trouvé : ${tenantBlock}`);
  }
});

// === Console errors check
await test('Console JS propre (0 erreur)', async () => {
  if (consoleErrors.length > 0) {
    throw new Error(`${consoleErrors.length} erreur(s) console : ${consoleErrors.slice(0, 3).join(' | ')}`);
  }
});

// === Mobile snapshots
await page.setViewportSize({ width: 375, height: 667 });
await page.goto(`${URL_BASE}/societes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.screenshot({ path: `${ARTIFACTS}/${TS}_pr8_societes_mobile.png`, fullPage: true });

await browser.close();
if (devProc) {
  devProc.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 500));
}

console.log('\n=== Résumé ===');
results.forEach((r) => console.log(r));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} OK · artefacts : ${ARTIFACTS}/`);
process.exit(failed > 0 ? 1 : 0);
