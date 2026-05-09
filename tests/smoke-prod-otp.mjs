// Smoke test prod Nat Life avec login OTP via fichier polling.
// Usage:
//   1. node tests/smoke-prod-otp.mjs (lance email OTP)
//   2. récupérer code 6+ chiffres dans Gmail lexialingo@gmail.com
//   3. printf '<code>' > /tmp/natlife-otp-code (ou variable env OTP_FILE)
//   4. script polle, complète login, lance smoke tests
// Artifacts: /tmp/natlife-qa/<timestamp>_*.png + report.txt
//
// Env vars optionnelles:
//   NATLIFE_URL    (default: https://dashboard.fka-holding.com)
//   NATLIFE_EMAIL  (default: lexialingo@gmail.com)
//   OTP_FILE       (default: /tmp/natlife-otp-code)
//   ARTIFACTS_DIR  (default: /tmp/natlife-qa)
//   PLAYWRIGHT_PKG (default: auto-resolve from cwd or fallback)

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
function resolvePlaywright() {
  if (process.env.PLAYWRIGHT_PKG) return process.env.PLAYWRIGHT_PKG;
  try { return require.resolve('playwright'); } catch {}
  const candidates = [
    '/Users/JC/dev/test-github/node_modules/playwright/index.mjs',
    path.resolve(process.cwd(), '../../node_modules/playwright/index.mjs'),
    path.resolve(process.cwd(), '../../../node_modules/playwright/index.mjs'),
    path.resolve(process.cwd(), 'node_modules/playwright/index.mjs'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || 'playwright';
}
const playwrightPath = resolvePlaywright();
const playwrightURL = playwrightPath.startsWith('/') ? pathToFileURL(playwrightPath).href : playwrightPath;
const { chromium } = await import(playwrightURL);

const ARTIFACTS = process.env.ARTIFACTS_DIR || '/tmp/natlife-qa';
fs.mkdirSync(ARTIFACTS, { recursive: true });
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const URL_BASE = process.env.NATLIFE_URL || 'https://dashboard.fka-holding.com';
const EMAIL = process.env.NATLIFE_EMAIL || 'lexialingo@gmail.com';
const OTP_FILE = process.env.OTP_FILE || '/tmp/natlife-otp-code';

if (fs.existsSync(OTP_FILE)) fs.unlinkSync(OTP_FILE);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});
const page = await context.newPage();

const consoleErrors = [];
const networkFails = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400 && !r.url().match(/favicon|\.png|\.jpg|\.svg/)) networkFails.push(`${r.status()} ${r.url()}`); });

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(`PASS ${name}`); console.log(`✅ ${name}`); }
  catch (e) { results.push(`FAIL ${name}: ${e.message}`); console.log(`❌ ${name}: ${e.message}`); }
}

// Phase 1: login email
console.log('=== Phase 1: submit email ===');
await page.goto(`${URL_BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 });
await page.fill('input[type="email"]', EMAIL);
await page.click('button[type="submit"]');

// Wait for OTP screen
await page.waitForSelector('input[name="token"], input[name="code"], input[inputmode="numeric"]', { timeout: 15000 });
await page.screenshot({ path: `${ARTIFACTS}/${TS}_otp_screen.png`, fullPage: true });
console.log(`📧 OTP envoyé à ${EMAIL}. Attente code dans ${OTP_FILE} (timeout 5min)...`);

// Phase 2: poll OTP file
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;
let waited = 0;
let otp = null;
while (waited < POLL_TIMEOUT_MS) {
  if (fs.existsSync(OTP_FILE)) {
    otp = fs.readFileSync(OTP_FILE, 'utf8').trim();
    if (otp.length >= 6) break;
  }
  await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  waited += POLL_INTERVAL_MS;
}
if (!otp) { console.log('❌ Timeout OTP'); process.exit(1); }
console.log(`✅ OTP reçu: ${otp}`);

// Phase 3: submit OTP
const otpInput = await page.$('input[name="token"], input[name="code"], input[inputmode="numeric"]');
await otpInput.fill(otp);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 });
console.log(`✅ Logged in. URL: ${page.url()}`);
await page.screenshot({ path: `${ARTIFACTS}/${TS}_post_login.png`, fullPage: true });

// Phase 4: tests P1
await test('P1-2a /fournisseurs col Type 1ère (data)', async () => {
  await page.goto(`${URL_BASE}/fournisseurs`, { waitUntil: 'networkidle' });
  await page.waitForSelector('table tbody tr a[href^="/fournisseurs/"]', { timeout: 10000 });
  // Skip selection checkbox col (empty button) — filter labels
  const headers = await page.$$eval('table thead th button', (btns) =>
    btns.map((b) => b.textContent.trim()).filter((t) => t.length > 0)
  );
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_fournisseurs_list.png`, fullPage: true });
  if (!headers[0]?.toLowerCase().includes('type')) throw new Error(`1ère col data = "${headers[0]}", attendu "Type". All: ${JSON.stringify(headers)}`);
  if (!headers[1]?.toLowerCase().includes('nom')) throw new Error(`2ème col data = "${headers[1]}", attendu "Nom". All: ${JSON.stringify(headers)}`);
});

await test('P1-2b badges TYPE rendus 2ème cellule (1ère data)', async () => {
  // Skip first td (selection checkbox) — col Type = nth-of-type(2)
  const firstDataCellTexts = await page.$$eval('table tbody tr td:nth-of-type(2)', (tds) => tds.map((td) => td.textContent.trim()));
  if (firstDataCellTexts.length === 0) throw new Error('0 lignes');
  const expected = ['NOTAIRE','BANQUE','JURIDIQUE','COMPTABILITE','ARCHITECTE','ENTREPRENEUR','SYNDIC','DIAGNOSTIC','ASSURANCE','AUTRE'];
  const valid = firstDataCellTexts.filter((t) => expected.some((e) => t.toUpperCase().includes(e)));
  if (valid.length === 0) throw new Error(`aucune cellule Type valide. Cellules: ${JSON.stringify(firstDataCellTexts.slice(0, 3))}`);
});

await test('P1-2c /fournisseurs/[id]/edit dropdown TYPE présent', async () => {
  const firstHref = await page.$eval('table tbody tr:first-child a[href^="/fournisseurs/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${firstHref}/edit`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_fournisseur_edit.png`, fullPage: true });
  const typeSelect = await page.$('select[name="type"]');
  if (!typeSelect) throw new Error('select[name="type"] absent');
  const opts = await page.$$eval('select[name="type"] option', (os) => os.map((o) => o.value));
  const expected = ['notaire','banque','juridique','comptabilite','architecte','entrepreneur','syndic','diagnostic','assurance','autre'];
  const missing = expected.filter((v) => !opts.includes(v));
  if (missing.length) throw new Error(`options manquantes: ${missing.join(',')}`);
});

await test('P1-1a /marches/new step 1 picker EntityCombobox', async () => {
  await page.goto(`${URL_BASE}/marches/new`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_marches_new_step1.png`, fullPage: true });
  const hiddenInput = await page.$('input[name="propertyId"][type="hidden"], input[name="propertyId"]');
  if (!hiddenInput) throw new Error('input propertyId absent');
});

await test('P1-1b /marches/new step 2 supplier combobox', async () => {
  // Pick first property to enter step 2
  const propBtn = await page.$('button[role="combobox"], [data-testid*="combobox"]');
  if (propBtn) {
    await propBtn.click();
    await page.waitForTimeout(500);
    const firstOpt = await page.$('[role="option"]');
    if (firstOpt) {
      await firstOpt.click();
      await page.click('button[type="submit"]');
      await page.waitForURL((u) => u.toString().includes('propertyId='), { timeout: 10000 });
      await page.screenshot({ path: `${ARTIFACTS}/${TS}_marches_new_step2.png`, fullPage: true });
      const supplierField = await page.$('input[name="supplierId"]');
      if (!supplierField) throw new Error('supplierId hidden field absent');
    }
  }
});

await test('P1-3A /locations bouton supprimer présent', async () => {
  await page.goto(`${URL_BASE}/locations`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_locations_list.png`, fullPage: true });
  const firstRow = await page.$('table tbody tr:first-child a[href^="/locations/"]');
  if (firstRow) {
    const href = await firstRow.getAttribute('href');
    await page.goto(`${URL_BASE}${href}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${ARTIFACTS}/${TS}_location_detail.png`, fullPage: true });
    const deleteBtn = await page.$('button:has-text("Supprimer"), [aria-label*="upprimer"], button:has(svg.lucide-trash), form[action*="delete"] button');
    if (!deleteBtn) throw new Error('bouton supprimer absent fiche location');
  }
});

await test('P1-3B inline-room-form autoComplete off', async () => {
  // Go to first lot
  await page.goto(`${URL_BASE}/biens`, { waitUntil: 'networkidle' });
  const firstLot = await page.$('a[href^="/biens/lots/"]');
  if (firstLot) {
    const href = await firstLot.getAttribute('href');
    await page.goto(`${URL_BASE}${href}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${ARTIFACTS}/${TS}_lot_detail.png`, fullPage: true });
    // Try Niveaux & pièces tab
    const tab = await page.$('button:has-text("Niveaux"), [role="tab"]:has-text("Niveaux")');
    if (tab) await tab.click();
    await page.waitForTimeout(500);
    const roomInput = await page.$('input[name="name"][placeholder*="alon"], input[name="name"][placeholder*="cuisine"]');
    if (roomInput) {
      const ac = await roomInput.getAttribute('autocomplete');
      if (ac !== 'off') throw new Error(`autoComplete = "${ac}", attendu "off"`);
    }
  }
});

await test('console errors filtered (excl Next RSC fallback)', async () => {
  const critical = consoleErrors.filter((e) =>
    !e.match(/favicon|manifest|404.*\.png/i) &&
    !e.includes('Failed to fetch RSC payload') &&
    !e.includes('Falling back to browser navigation')
  );
  if (critical.length > 0) throw new Error(`${critical.length} errors: ${critical.slice(0, 3).join(' | ')}`);
});

await test('network fails filtered', async () => {
  if (networkFails.length > 0) throw new Error(`${networkFails.length} fails: ${networkFails.slice(0, 3).join(' | ')}`);
});

await browser.close();

const passed = results.filter((r) => r.startsWith('PASS')).length;
const failed = results.filter((r) => r.startsWith('FAIL')).length;
const report = `
=== Smoke Nat Life V1.7 P4 (auth) — ${TS} ===
Tests: ${results.length} | Passed: ${passed} | Failed: ${failed}

${results.join('\n')}

Console errors: ${consoleErrors.length}
Network fails: ${networkFails.length}
`;
fs.writeFileSync(`${ARTIFACTS}/${TS}_report_auth.txt`, report);
console.log(report);
process.exit(failed > 0 ? 1 : 0);
