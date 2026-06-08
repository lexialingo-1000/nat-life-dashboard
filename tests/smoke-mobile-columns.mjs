// Smoke dashboard-22 mobile — gestion des colonnes / vue carte sur portable.
//
// Couvre la demande "tableaux lisibles sur mobile" (TachesListTable) :
//   MC-1 — /marches/[id]?tab=suivi à 390px : vue carte présente, table desktop masquée
//   MC-2 — pas de scroll horizontal (scrollWidth ≈ clientWidth)
//   MC-3 — défauts mobiles : Échéance visible, Emplacement masqué par défaut ;
//          titre + statut présents dans la carte
//   MC-4 — bouton « Colonnes » : cocher Emplacement → label apparaît, persiste au reload
//   MC-5 — 0 erreur console sur la route
//
// Usage :
//   NATLIFE_URL=<preview> node Apps/nat-life/tests/smoke-mobile-columns.mjs
//   (reuse storage-state.json si présent ; sinon OTP via /tmp/natlife-otp-code)
//
// PRÉREQUIS : la branche jc/feat-natlife-mobile-columns doit être déployée
// (preview Coolify ou prod). Contre du code antérieur, MC-1/MC-3/MC-4 échouent.

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
// dashboard-22 mobile — contexte téléphone (iPhone 12/13 ≈ 390×844).
const contextOpts = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
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
          path: `${ARTIFACTS}/${TS}_mobcol_fail_${name.replace(/[^\w]+/g, '_').slice(0, 40)}.png`,
          fullPage: true,
        });
      } catch {}
    }
  }
}

// ===========================================================================
// Auth (session reuse + OTP fallback poll) — calqué sur smoke-v115.mjs
// ===========================================================================
let sessionValid = false;
if (contextOpts.storageState) {
  try {
    const probe = await page.goto(`${URL_BASE}/marches`, {
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
  await page.waitForSelector('input[name="token"], input[name="code"], input[inputmode="numeric"]', {
    timeout: 20000,
  });
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
    'input[name="token"], input[name="code"], input[inputmode="numeric"]',
  );
  await otpInput.fill(otp);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 });
  console.log(`✅ Logged in: ${page.url()}`);
  await context.storageState({ path: STORAGE_STATE });
}

// ===========================================================================
// Helper : trouver un marché avec au moins 1 tâche (onglet suivi → TachesListTable)
// ===========================================================================
async function findMarcheWithTaches() {
  await page.goto(`${URL_BASE}/marches`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main a[href^="/marches/"]'))
      .map((a) => a.getAttribute('href'))
      .filter((h, i, arr) => h && /^\/marches\/[0-9a-f-]{36}$/.test(h) && arr.indexOf(h) === i),
  );
  for (const href of hrefs.slice(0, 20)) {
    await page.goto(`${URL_BASE}${href}?tab=suivi`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    // La vue carte mobile expose au moins une .card dans le bloc sm:hidden.
    const cards = await page.locator('div.sm\\:hidden .card').count();
    const rows = await page.locator('table tbody tr').count();
    if (cards > 0 || rows > 0) return href;
  }
  return null;
}

let marcheHref = null;

// ===========================================================================
// MC-1 — Vue carte présente, table desktop non visible à 390px
// ===========================================================================
await test('MC-1 /marches/[id]?tab=suivi : vue carte mobile, table desktop masquée', async () => {
  marcheHref = await findMarcheWithTaches();
  if (!marcheHref) skip('aucun marché avec tâches');
  await page.goto(`${URL_BASE}${marcheHref}?tab=suivi`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(800);

  const cardCount = await page.locator('div.sm\\:hidden .card').count();
  if (cardCount === 0) throw new Error('aucune carte mobile rendue (vue carte absente)');

  // La table desktop est dans un conteneur .hidden.sm:block → invisible à 390px.
  const tableVisible = await page
    .locator('table')
    .first()
    .isVisible()
    .catch(() => false);
  if (tableVisible) throw new Error('table desktop visible à 390px (devrait être masquée)');

  await page.screenshot({
    path: `${ARTIFACTS}/${TS}_mobcol_mc1_cards.png`,
    fullPage: true,
  });
});

// ===========================================================================
// MC-2 — Pas de scroll horizontal (signal clé "tout voir sur téléphone")
// ===========================================================================
await test('MC-2 pas de scroll horizontal à 390px', async () => {
  if (!marcheHref) skip('MC-1 pré-requis');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log(`   overflow horizontal = ${overflow}px`);
  if (overflow > 4) throw new Error(`scroll horizontal détecté: ${overflow}px`);
});

// ===========================================================================
// MC-3 — Défauts mobiles : Échéance visible, Emplacement masqué ; titre+statut présents
// ===========================================================================
await test('MC-3 défauts colonnes mobile (Échéance oui, Emplacement non)', async () => {
  if (!marcheHref) skip('MC-1 pré-requis');
  const firstCard = page.locator('div.sm\\:hidden .card').first();
  const cardText = await firstCard.innerText();

  if (!/Échéance/i.test(cardText)) throw new Error('label Échéance absent (devrait être visible)');
  if (/Emplacement/i.test(cardText))
    throw new Error('label Emplacement présent (devrait être masqué par défaut)');

  // Statut interactif (select) présent dans la carte.
  const statusControls = await firstCard.locator('select, [role="combobox"], button').count();
  if (statusControls === 0) throw new Error('contrôle de statut absent de la carte');
});

// ===========================================================================
// MC-4 — Picker « Colonnes » : activer Emplacement → apparaît, persiste au reload
// ===========================================================================
await test('MC-4 picker Colonnes : Emplacement activable + persistant', async () => {
  if (!marcheHref) skip('MC-1 pré-requis');

  await page.locator('button:has-text("Colonnes")').first().click();
  await page.waitForTimeout(200);
  // Coche la ligne Emplacement dans le popover.
  const empLabel = page.locator('label:has-text("Emplacement")').first();
  await empLabel.locator('input[type="checkbox"]').check();
  await page.waitForTimeout(300);

  let cardText = await page.locator('div.sm\\:hidden .card').first().innerText();
  if (!/Emplacement/i.test(cardText))
    throw new Error('Emplacement non apparu après activation dans le picker');

  // Reload → la préférence localStorage natlife:taches-list doit persister.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  cardText = await page.locator('div.sm\\:hidden .card').first().innerText();
  if (!/Emplacement/i.test(cardText))
    throw new Error('Emplacement non persisté après reload (localStorage)');

  await page.screenshot({
    path: `${ARTIFACTS}/${TS}_mobcol_mc4_emplacement_on.png`,
    fullPage: true,
  });
});

// ===========================================================================
// MC-5 — Garde-fou erreurs console
// ===========================================================================
await test('MC-5 aucune erreur console sur la route suivi', async () => {
  if (consoleErrors.length > 0) {
    throw new Error(`${consoleErrors.length} erreur(s) console: ${consoleErrors.slice(0, 3).join(' | ')}`);
  }
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
fs.writeFileSync(`${ARTIFACTS}/${TS}_mobcol_summary.json`, JSON.stringify(summary, null, 2));
console.log('\n=== dashboard-22 mobile-columns smoke summary ===');
console.log(`  PASS: ${summary.pass}`);
console.log(`  FAIL: ${summary.fail}`);
console.log(`  SKIP: ${summary.skip}`);
console.log(`  Console errors: ${summary.consoleErrors}`);
console.log(`  Artifacts: ${ARTIFACTS}/${TS}_mobcol_*`);

process.exit(summary.fail === 0 ? 0 : 1);
