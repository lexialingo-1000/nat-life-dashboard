// Smoke V1.15 (Remarques client dashboard-19.pages) contre prod.
//
// Couvre les 3 demandes v19 :
//   S-1  — /societes : colonnes Forme/NAF/Siège retirées, N° TVA ajoutée
//   CF-1 — /fournisseurs/[id]?tab=factures : rupture par LOT (sections + sous-total)
//   CF-2 — /fournisseurs/[id]?tab=factures : colonne MARCHE affiche description (≠ name)
//   MF-1 — /biens/properties/[id]/marches/new : champ "Statut" absent du form
//
// Usage :
//   node Apps/nat-life/tests/smoke-v115.mjs
//   (reuse storage-state.json si présent ; sinon OTP via /tmp/natlife-otp-code)
//
// PRÉREQUIS : V1.15 doit être déployée (prod ou preview Coolify). Sinon S-1 et
// CF-1 échoueront car le code prod reste V1.14.

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
function resolvePlaywright() {
  if (process.env.PLAYWRIGHT_PKG) return process.env.PLAYWRIGHT_PKG;
  try {
    const cjsPath = require.resolve('playwright');
    const mjsCandidate = cjsPath.replace(/index\.(c?js)$/, 'index.mjs');
    if (fs.existsSync(mjsCandidate)) return mjsCandidate;
    return cjsPath;
  } catch {}
  const candidates = [
    '/Users/JC/dev/test-github/node_modules/playwright/index.mjs',
    path.resolve(process.cwd(), 'node_modules/playwright/index.mjs'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || 'playwright';
}
const playwrightPath = resolvePlaywright();
const playwrightURL = playwrightPath.startsWith('/')
  ? pathToFileURL(playwrightPath).href
  : playwrightPath;
const playwrightMod = await import(playwrightURL);
const chromium = playwrightMod.chromium || playwrightMod.default?.chromium;
if (!chromium) throw new Error('chromium export missing');

const ARTIFACTS = process.env.ARTIFACTS_DIR || '/tmp/natlife-qa';
fs.mkdirSync(ARTIFACTS, { recursive: true });
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const URL_BASE = process.env.NATLIFE_URL || 'https://dashboard.fka-holding.com';
const EMAIL = process.env.NATLIFE_EMAIL || 'lexialingo@gmail.com';
const OTP_FILE = process.env.OTP_FILE || '/tmp/natlife-otp-code';
const STORAGE_STATE = process.env.STORAGE_STATE || path.join(ARTIFACTS, 'storage-state.json');
const FORCE_RELOGIN = process.env.FORCE_RELOGIN === '1';

const browser = await chromium.launch({ headless: true });
const contextOpts = {
  viewport: { width: 1920, height: 1080 },
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};
if (!FORCE_RELOGIN && fs.existsSync(STORAGE_STATE)) {
  contextOpts.storageState = STORAGE_STATE;
  console.log(`🔁 Reuse session: ${STORAGE_STATE}`);
}
const context = await browser.newContext(contextOpts);
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});

const results = [];
class SkipError extends Error {
  constructor(m) {
    super(m);
    this.skip = true;
  }
}
function skip(msg) {
  throw new SkipError(msg);
}
async function test(name, fn) {
  try {
    await fn();
    results.push(`PASS ${name}`);
    console.log(`✅ ${name}`);
  } catch (e) {
    if (e instanceof SkipError) {
      results.push(`SKIP ${name}: ${e.message}`);
      console.log(`⏭  ${name} skipped: ${e.message}`);
    } else {
      results.push(`FAIL ${name}: ${e.message}`);
      console.log(`❌ ${name}: ${e.message}`);
      try {
        await page.screenshot({
          path: `${ARTIFACTS}/${TS}_v115_fail_${name.replace(/[^\w]+/g, '_').slice(0, 40)}.png`,
          fullPage: true,
        });
      } catch {}
    }
  }
}

// ===========================================================================
// Auth (session reuse + OTP fallback poll)
// ===========================================================================
let sessionValid = false;
if (contextOpts.storageState) {
  try {
    const probe = await page.goto(`${URL_BASE}/societes`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    if (probe && probe.status() === 200 && !page.url().includes('/login')) {
      sessionValid = true;
      console.log(`✅ Session OK. URL: ${page.url()}`);
    }
  } catch {}
}
if (!sessionValid) {
  if (fs.existsSync(OTP_FILE)) fs.unlinkSync(OTP_FILE);
  await page.goto(`${URL_BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.click('button[type="submit"]');
  await page.waitForSelector(
    'input[name="token"], input[name="code"], input[inputmode="numeric"]',
    { timeout: 20000 }
  );
  console.log(`📧 OTP envoyé. Attente ${OTP_FILE} (max 10 min)`);
  const POLL_TIMEOUT_MS = 10 * 60 * 1000;
  let waited = 0;
  let otp = null;
  while (waited < POLL_TIMEOUT_MS) {
    if (fs.existsSync(OTP_FILE)) {
      otp = fs.readFileSync(OTP_FILE, 'utf8').trim();
      if (otp.length >= 6) break;
    }
    await new Promise((r) => setTimeout(r, 2000));
    waited += 2000;
  }
  if (!otp) {
    console.log('❌ Timeout OTP');
    process.exit(1);
  }
  const otpInput = await page.$(
    'input[name="token"], input[name="code"], input[inputmode="numeric"]'
  );
  await otpInput.fill(otp);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 });
  console.log(`✅ Logged in: ${page.url()}`);
  await context.storageState({ path: STORAGE_STATE });
}

// ===========================================================================
// S-1 — Liste sociétés : colonnes Forme/NAF/Siège retirées, N° TVA ajoutée
// ===========================================================================
await test('S-1 /societes : headers visibles (Société, État, Type, SIREN, N° TVA)', async () => {
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (page.url().includes('/login')) skip('redirect login');
  await page.waitForTimeout(800);

  // Récupérer tous les headers (button text dans thead)
  const headers = await page
    .locator('main thead th button')
    .allTextContents();
  const norm = headers.map((h) => h.trim()).filter(Boolean);
  console.log(`   Headers: [${norm.join(' | ')}]`);

  const expectedPresent = ['Société', 'État', 'Type', 'SIREN', 'N° TVA'];
  const expectedAbsent = ['Forme', 'NAF', 'Siège'];

  for (const h of expectedPresent) {
    if (!norm.includes(h)) throw new Error(`header "${h}" attendu mais absent`);
  }
  for (const h of expectedAbsent) {
    if (norm.includes(h)) throw new Error(`header "${h}" doit être retiré`);
  }

  await page.screenshot({
    path: `${ARTIFACTS}/${TS}_v115_s1_societes_desktop.png`,
    fullPage: true,
  });
});

// ===========================================================================
// Helper : trouver un fournisseur avec au moins 1 facture (pour CF-1, CF-2)
// ===========================================================================
async function findSupplierWithFactures() {
  await page.goto(`${URL_BASE}/fournisseurs`, { waitUntil: 'domcontentloaded' });
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main table tbody a[href^="/fournisseurs/"]'))
      .map((a) => a.getAttribute('href'))
      .filter((h, i, arr) => h && h.match(/^\/fournisseurs\/[0-9a-f-]{36}$/) && arr.indexOf(h) === i)
  );
  for (const href of hrefs.slice(0, 20)) {
    await page.goto(`${URL_BASE}${href}?tab=factures`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const docsCount = await page.locator('main table tbody tr').count();
    if (docsCount > 0) return href;
  }
  return null;
}

let supplierHref = null;

// ===========================================================================
// CF-1 — Rupture par LOT visible dans onglet Compta fournisseur
// ===========================================================================
await test('CF-1 fournisseur Compta : rupture par LOT (sections + sous-totaux)', async () => {
  supplierHref = await findSupplierWithFactures();
  if (!supplierHref) skip('aucun fournisseur avec factures en prod');
  await page.goto(`${URL_BASE}${supplierHref}?tab=factures`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(800);

  // Sections rupture : <header> avec <h3 uppercase tracking> + "HT :" + "TTC :"
  const sectionHeaders = await page
    .locator('main section h3.uppercase')
    .allTextContents();
  if (sectionHeaders.length === 0)
    throw new Error('aucun header de section LOT — rupture absente');
  console.log(`   ${sectionHeaders.length} section(s) lot : ${sectionHeaders.slice(0, 3).join(' | ')}…`);

  // Au moins 1 sous-total visible
  const subtotalCount = await page.locator('main section header span:has-text("HT :")').count();
  if (subtotalCount === 0) throw new Error('aucun sous-total HT visible');

  await page.screenshot({
    path: `${ARTIFACTS}/${TS}_v115_cf1_rupture_lot.png`,
    fullPage: true,
  });
});

// ===========================================================================
// CF-2 — Colonne MARCHE affiche description (≠ nom fournisseur)
// ===========================================================================
await test('CF-2 fournisseur Compta : colonne MARCHE ≠ nom fournisseur', async () => {
  if (!supplierHref) skip('CF-1 pré-requis');
  // Récupérer nom fournisseur depuis <h1> ou breadcrumb
  const supplierName = (await page.locator('main h1').first().innerText()).trim();
  // Récupérer cells colonne Marché (header index)
  const headers = await page.locator('main table thead th').allTextContents();
  const marcheIdx = headers.findIndex((h) => h.trim().toLowerCase().startsWith('marché'));
  if (marcheIdx < 0) throw new Error('colonne Marché introuvable dans headers');

  const marcheCells = await page
    .locator(`main table tbody tr td:nth-child(${marcheIdx + 1})`)
    .allTextContents();
  const nonEmpty = marcheCells.map((c) => c.trim()).filter((c) => c && c !== '—');
  if (nonEmpty.length === 0) skip('aucune row avec marché renseigné pour valider');

  // Le nom du fournisseur ne devrait pas être strictement égal à la valeur colonne Marché
  const matchSupplier = nonEmpty.filter((v) => v === supplierName).length;
  if (matchSupplier === nonEmpty.length)
    throw new Error(`colonne Marché affiche le nom fournisseur "${supplierName}" (régression v19-2a)`);
  console.log(`   ${nonEmpty.length} cells marché : ex "${nonEmpty[0]}"`);
});

// ===========================================================================
// MF-1 — Formulaire marché travaux : champ Statut absent
// ===========================================================================
await test('MF-1 marché travaux new : champ "Statut" absent du formulaire', async () => {
  // Trouver un bien (property) actif pour accéder à /biens/properties/[id]/marches/new
  await page.goto(`${URL_BASE}/biens`, { waitUntil: 'domcontentloaded' });
  const propHref = await page.evaluate(() => {
    const a = document.querySelector('main table tbody a[href^="/biens/properties/"]');
    return a?.getAttribute('href') ?? null;
  });
  if (!propHref) skip('aucun bien en prod');

  // Aller directement sur le form new
  await page.goto(`${URL_BASE}${propHref}/marches/new`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(600);

  // Le label "Statut" ne doit pas exister
  const statutLabels = await page.locator('form label:has-text("Statut")').count();
  if (statutLabels > 0) throw new Error('label "Statut" toujours présent dans le form');

  // Le name="status" select ne doit pas exister non plus
  const statusSelect = await page.locator('form select[name="status"]').count();
  if (statusSelect > 0) throw new Error('select[name="status"] toujours présent');

  // Sanity : autres champs attendus présents
  const descLabel = await page.locator('form label:has-text("Description")').count();
  if (descLabel === 0) throw new Error('label Description manquant — form cassé');

  await page.screenshot({
    path: `${ARTIFACTS}/${TS}_v115_mf1_marche_form.png`,
    fullPage: true,
  });
});

// ===========================================================================
// Wrap up
// ===========================================================================
await browser.close();

const summary = {
  ts: TS,
  total: results.length,
  pass: results.filter((r) => r.startsWith('PASS')).length,
  fail: results.filter((r) => r.startsWith('FAIL')).length,
  skip: results.filter((r) => r.startsWith('SKIP')).length,
  consoleErrors: consoleErrors.length,
  results,
};
fs.writeFileSync(
  `${ARTIFACTS}/${TS}_v115_summary.json`,
  JSON.stringify(summary, null, 2)
);
console.log('\n=== V1.15 smoke summary ===');
console.log(`  PASS: ${summary.pass}`);
console.log(`  FAIL: ${summary.fail}`);
console.log(`  SKIP: ${summary.skip}`);
console.log(`  Console errors: ${summary.consoleErrors}`);
console.log(`  Artifacts: ${ARTIFACTS}/${TS}_v115_*`);

process.exit(summary.fail === 0 ? 0 : 1);
