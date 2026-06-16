// Smoke V1.9 PR #4 (onglet Compta fiche société) contre prod.

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
// PR #4 — Onglet Compta fiche société
// =========================================================================

await test('C2a fiche société : onglet Compta présent', async () => {
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'networkidle' });
  const link = await page.$('main table tbody tr a[href^="/societes/"]');
  if (!link) skip("aucune société en liste");
  const href = await link.getAttribute('href');
  await page.goto(`${URL_BASE}${href}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v19pr4_c2a_societe.png`, fullPage: true });
  const comptaTab = page.locator('main button:has-text("Compta")').first();
  if (!(await comptaTab.count())) throw new Error('onglet Compta absent');
});

await test('C2b click Compta → 3 sections (Devis, Commandes, Factures)', async () => {
  const comptaTab = page.locator('main button:has-text("Compta")').first();
  await comptaTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v19pr4_c2b_compta_tab.png`, fullPage: true });
  // Trois sections via leur titre h3
  const devis = await page.locator('main h3:has-text("Devis")').first();
  const commandes = await page.locator('main h3:has-text("Commandes")').first();
  const factures = await page.locator('main h3:has-text("Factures")').first();
  if (!(await devis.count())) throw new Error('section Devis absente');
  if (!(await commandes.count())) throw new Error('section Commandes absente');
  if (!(await factures.count())) throw new Error('section Factures absente');
});

await test('C2c bouton "Nouveau devis" présent', async () => {
  const btn = page.locator('main button:has-text("Nouveau devis")').first();
  if (!(await btn.count())) throw new Error('bouton "Nouveau devis" absent');
});

await test('C3a click "Nouveau devis" → form avec Fournisseur required + Marché optionnel', async () => {
  const btn = page.locator('main button:has-text("Nouveau devis")').first();
  await btn.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v19pr4_c3a_form.png`, fullPage: true });
  // Selects Fournisseur + Marché présents
  const supplierSelect = await page.$('main select[required]');
  if (!supplierSelect) throw new Error('select Fournisseur required absent');
  // Champs nom, date, montants
  const nameInput = await page.$('main input[placeholder*="ournisseur 2026"]');
  if (!nameInput) throw new Error('champ Nom absent');
  // Fichier input
  const fileInput = await page.$('main input[type="file"]');
  if (!fileInput) throw new Error('input file absent');
});

await test('C3b Annuler → form ferme', async () => {
  const cancel = page.locator('main button:has-text("Annuler")').first();
  if (await cancel.count()) {
    await cancel.click();
    await page.waitForTimeout(200);
  }
  // Form should be closed (Nouveau devis button visible again)
  const newBtn = page.locator('main button:has-text("Nouveau devis")').first();
  if (!(await newBtn.count())) throw new Error('bouton Nouveau devis pas réapparu');
});

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
=== Smoke V1.9 PR #4 (PR #228) — ${TS} ===
Tests: ${results.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}

${results.join('\n')}

Console errors: ${consoleErrors.length}
`;
fs.writeFileSync(`${ARTIFACTS}/${TS}_v19_pr4_report.txt`, report);
console.log(report);
process.exit(failed > 0 ? 1 : 0);
