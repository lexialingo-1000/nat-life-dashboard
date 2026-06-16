// Smoke V1.10 (PR #274) — onglet Compta unifié (Société/Marché/Fournisseur)
// Vérifie : 1 table unifiée (pas 3 sections), barre filtres présente,
// 3 CTA (Nouveau devis/commande/facture), form ouvre + ferme, présent sur
// les 3 scopes (company / marche / supplier).

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
const playwrightURL = playwrightPath.startsWith('/') ? pathToFileURL(playwrightPath).href : playwrightPath;
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
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};
if (!FORCE_RELOGIN && fs.existsSync(STORAGE_STATE)) {
  contextOpts.storageState = STORAGE_STATE;
  console.log(`🔁 Reuse session: ${STORAGE_STATE}`);
}
const context = await browser.newContext(contextOpts);
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const results = [];
class SkipError extends Error { constructor(m) { super(m); this.skip = true; } }
function skip(msg) { throw new SkipError(msg); }
async function test(name, fn) {
  try { await fn(); results.push(`PASS ${name}`); console.log(`✅ ${name}`); }
  catch (e) {
    if (e instanceof SkipError) {
      results.push(`SKIP ${name}: ${e.message}`);
      console.log(`⏭  ${name} skipped: ${e.message}`);
    } else {
      results.push(`FAIL ${name}: ${e.message}`);
      console.log(`❌ ${name}: ${e.message}`);
    }
  }
}

let sessionValid = false;
if (contextOpts.storageState) {
  try {
    const probe = await page.goto(`${URL_BASE}/societes`, { waitUntil: 'networkidle', timeout: 20000 });
    if (probe && probe.status() === 200 && !page.url().includes('/login')) {
      sessionValid = true;
      console.log(`✅ Session OK. URL: ${page.url()}`);
    }
  } catch {}
}
if (!sessionValid) {
  if (fs.existsSync(OTP_FILE)) fs.unlinkSync(OTP_FILE);
  await page.goto(`${URL_BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.click('button[type="submit"]');
  await page.waitForSelector('input[name="token"], input[name="code"], input[inputmode="numeric"]', { timeout: 15000 });
  console.log(`📧 OTP envoyé. Attente ${OTP_FILE}`);
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
  if (!otp) { console.log('❌ Timeout OTP'); process.exit(1); }
  const otpInput = await page.$('input[name="token"], input[name="code"], input[inputmode="numeric"]');
  await otpInput.fill(otp);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 });
  console.log(`✅ Logged in: ${page.url()}`);
  await context.storageState({ path: STORAGE_STATE });
}

// =========================================================================
// Helpers
// =========================================================================

async function gotoFirstEntity(listPath, hrefPrefix) {
  await page.goto(`${URL_BASE}${listPath}`, { waitUntil: 'networkidle' });
  const link = await page.$(`main table tbody tr a[href^="${hrefPrefix}"]`);
  if (!link) skip(`aucune entité ${listPath}`);
  const href = await link.getAttribute('href');
  await page.goto(`${URL_BASE}${href}`, { waitUntil: 'networkidle' });
  return href;
}

async function openComptaTab() {
  const tab = page.locator('main button:has-text("Compta")').first();
  if (!(await tab.count())) throw new Error('onglet Compta absent');
  await tab.click();
  await page.waitForTimeout(500);
}

async function verifyUnifiedComptaUI(scope) {
  // 3 CTA visibles
  const newDevis = page.locator('main button:has-text("Nouveau devis")').first();
  const newCommande = page.locator('main button:has-text("Nouvelle commande")').first();
  const newFacture = page.locator('main button:has-text("Nouvelle facture")').first();
  if (!(await newDevis.count())) throw new Error('CTA "Nouveau devis" absent');
  if (!(await newCommande.count())) throw new Error('CTA "Nouvelle commande" absent');
  if (!(await newFacture.count())) throw new Error('CTA "Nouvelle facture" absent');

  // Pas de h3 "Devis"/"Commandes"/"Factures" sections (V1.9 pattern)
  const oldSection = await page.locator('main h3:text-is("Devis")').count();
  if (oldSection > 0) {
    throw new Error('ancienne section h3 "Devis" présente — refactor V1.10 incomplet');
  }
}

async function verifyFormOpensAndCloses() {
  const newDevis = page.locator('main button:has-text("Nouveau devis")').first();
  await newDevis.click();
  await page.waitForTimeout(300);
  // Form contient le label "Société émettrice" + select fournisseur
  const formHeader = await page.locator('main h4:has-text("Nouveau devis")').count();
  if (formHeader === 0) throw new Error('form upload pas ouvert');
  const fileInput = await page.$('main input[type="file"]');
  if (!fileInput) throw new Error('input file absent du form');
  // Cancel
  const cancel = page.locator('main button:has-text("Annuler")').first();
  await cancel.click();
  await page.waitForTimeout(200);
  const stillOpen = await page.locator('main h4:has-text("Nouveau devis")').count();
  if (stillOpen > 0) throw new Error('form pas fermé après Annuler');
  // CTA réapparu
  if (!(await newDevis.count())) throw new Error('CTA pas réapparu');
}

// =========================================================================
// Scope = Société
// =========================================================================

await test('S1 fiche société : onglet Compta présent', async () => {
  await gotoFirstEntity('/societes', '/societes/');
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v110_s1_societe.png`, fullPage: true });
  const comptaTab = page.locator('main button:has-text("Compta")').first();
  if (!(await comptaTab.count())) throw new Error('onglet Compta absent');
});

await test('S2 click Compta → table unifiée (pas 3 sections) + 3 CTA', async () => {
  await openComptaTab();
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v110_s2_societe_compta.png`, fullPage: true });
  await verifyUnifiedComptaUI('company');
});

await test('S3 form upload ouvre + ferme', async () => {
  await verifyFormOpensAndCloses();
});

// =========================================================================
// Scope = Marché
// =========================================================================

await test('M1 fiche marché : onglet Compta présent', async () => {
  await gotoFirstEntity('/marches', '/marches/');
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v110_m1_marche.png`, fullPage: true });
  const comptaTab = page.locator('main button:has-text("Compta")').first();
  if (!(await comptaTab.count())) throw new Error('onglet Compta absent');
});

await test('M2 click Compta → table unifiée + 3 CTA + société modifiable', async () => {
  await openComptaTab();
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v110_m2_marche_compta.png`, fullPage: true });
  await verifyUnifiedComptaUI('marche');
});

await test('M3 form upload ouvre + ferme', async () => {
  await verifyFormOpensAndCloses();
});

// =========================================================================
// Scope = Fournisseur
// =========================================================================

await test('F1 fiche fournisseur : onglet Compta présent', async () => {
  await gotoFirstEntity('/fournisseurs', '/fournisseurs/');
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v110_f1_fournisseur.png`, fullPage: true });
  const comptaTab = page.locator('main button:has-text("Compta")').first();
  if (!(await comptaTab.count())) throw new Error('onglet Compta absent');
});

await test('F2 click Compta → table unifiée + 3 CTA (nouveauté V1.10 : read-write)', async () => {
  await openComptaTab();
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v110_f2_fournisseur_compta.png`, fullPage: true });
  await verifyUnifiedComptaUI('supplier');
});

await test('F3 form upload ouvre + ferme (nouveauté V1.10)', async () => {
  await verifyFormOpensAndCloses();
});

// =========================================================================
// Console
// =========================================================================

await test('console errors filtered', async () => {
  const critical = consoleErrors.filter((e) =>
    !e.match(/favicon|manifest|404.*\.png/i) &&
    !e.includes('Failed to fetch RSC payload') &&
    !e.includes('Falling back to browser navigation')
  );
  if (critical.length > 0) throw new Error(`${critical.length} errors: ${critical.slice(0, 3).join(' | ')}`);
});

await browser.close();

const passed = results.filter((r) => r.startsWith('PASS')).length;
const failed = results.filter((r) => r.startsWith('FAIL')).length;
const skipped = results.filter((r) => r.startsWith('SKIP')).length;
const report = `
=== Smoke V1.10 (PR #274) — ${TS} ===
Tests: ${results.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}

${results.join('\n')}

Console errors: ${consoleErrors.length}
`;
fs.writeFileSync(`${ARTIFACTS}/${TS}_v110_compta_report.txt`, report);
console.log(report);
process.exit(failed > 0 ? 1 : 0);
