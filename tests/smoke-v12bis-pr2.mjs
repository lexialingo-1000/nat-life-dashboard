// Smoke V12bis PR2 — Paramètres admin paramétrables (F1+F2+F3+K1)
// Réutilise storage state PR1 si valide, sinon OTP via gws Gmail.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
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
const playwrightURL = pathToFileURL(resolvePlaywright()).href;
const playwrightMod = await import(playwrightURL);
const chromium = playwrightMod.chromium || playwrightMod.default?.chromium;

const ARTIFACTS = process.env.ARTIFACTS_DIR || '/tmp/natlife-qa';
fs.mkdirSync(ARTIFACTS, { recursive: true });
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const URL_BASE = process.env.NATLIFE_URL || 'https://dashboard.fka-holding.com';
const EMAIL = process.env.NATLIFE_EMAIL || 'lexialingo@gmail.com';
const STORAGE_STATE = process.env.STORAGE_STATE || path.join(ARTIFACTS, 'storage-state.json');
const OTP_FILE = process.env.OTP_FILE || '/tmp/natlife-otp-code';

const browser = await chromium.launch({ headless: true });
const ctxOpts = {
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};
if (fs.existsSync(STORAGE_STATE)) ctxOpts.storageState = STORAGE_STATE;
const context = await browser.newContext(ctxOpts);
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(`PASS ${name}`); console.log(`✅ ${name}`); }
  catch (e) { results.push(`FAIL ${name}: ${e.message}`); console.log(`❌ ${name}: ${e.message}`); }
}

// Session reuse / OTP
let sessionValid = false;
try {
  const probe = await page.goto(`${URL_BASE}/admin/parametres`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  if (probe && probe.status() === 200 && !page.url().includes('/login')) {
    sessionValid = true;
    console.log('✅ Session reuse OK');
  }
} catch {}

if (!sessionValid) {
  console.log('=== OTP login ===');
  if (fs.existsSync(OTP_FILE)) fs.unlinkSync(OTP_FILE);
  await page.goto(`${URL_BASE}/login`, { waitUntil: 'networkidle', timeout: 25000 });
  await page.fill('input[type="email"]', EMAIL);
  const sentAtMs = Date.now() - 5000;
  await page.click('button[type="submit"]');
  await page.waitForSelector('input[name="token"], input[name="code"], input[inputmode="numeric"]', { timeout: 15000 });

  const POLL_TIMEOUT_MS = 180 * 1000;
  const POLL_INTERVAL_MS = 5000;
  const FRESHNESS_FLOOR = sentAtMs - 20 * 1000;
  let waited = 0;
  let otp = null;
  function fetchOtp() {
    try {
      const listOut = execSync(`gws gmail users messages list --params '{"userId":"me","q":"from:noreply@fka-holding.com newer_than:1h","maxResults":5}' --format json 2>/dev/null`, { encoding: 'utf8', timeout: 20000 });
      const list = JSON.parse(listOut || '{}');
      for (const m of (list.messages || [])) {
        const det = execSync(`gws gmail users messages get --params '{"userId":"me","id":"${m.id}","format":"full"}' --format json 2>/dev/null`, { encoding: 'utf8', timeout: 15000 });
        const parsed = JSON.parse(det);
        const internalDate = Number(parsed.internalDate || 0);
        if (internalDate < FRESHNESS_FLOOR) continue;
        function walk(p, acc) {
          if (p?.body?.data) { try { acc.push(Buffer.from(p.body.data, 'base64').toString('utf8')); } catch {} }
          for (const sp of p?.parts || []) walk(sp, acc);
        }
        const parts = [];
        walk(parsed.payload || {}, parts);
        const body = parts.join(' ') + ' ' + (parsed.snippet || '');
        const match = body.match(/\b(\d{6,8})\b/);
        if (match) return match[1];
      }
    } catch {}
    return null;
  }
  while (waited < POLL_TIMEOUT_MS) {
    otp = fetchOtp();
    if (otp) break;
    if (fs.existsSync(OTP_FILE)) { const c = fs.readFileSync(OTP_FILE, 'utf8').trim(); if (c.length >= 6) { otp = c; break; } }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    waited += POLL_INTERVAL_MS;
  }
  console.log('');
  if (!otp) { console.log('❌ Timeout OTP'); process.exit(1); }
  const inp = await page.$('input[name="token"], input[name="code"], input[inputmode="numeric"]');
  await inp.fill(otp);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 });
  await context.storageState({ path: STORAGE_STATE });
  console.log('💾 Session sauvée');
  await page.goto(`${URL_BASE}/admin/parametres`, { waitUntil: 'domcontentloaded', timeout: 25000 });
}

// =============================================================================
// F1 — Sidebar refonte
// =============================================================================
await test('F1a Sidebar : "Paramètres" + "Utilisateurs" présents', async () => {
  await page.goto(`${URL_BASE}/`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  const sidebarParam = await page.$('aside a[href="/admin/parametres"]');
  const sidebarUsers = await page.$('aside a[href="/admin/utilisateurs"]');
  if (!sidebarParam) throw new Error('Item sidebar /admin/parametres absent');
  if (!sidebarUsers) throw new Error('Item sidebar /admin/utilisateurs absent');
});

await test('F1b Sidebar : "Types de documents" et "Types de marchés" retirés', async () => {
  const directTypesDoc = await page.$('aside a[href="/admin/types-documents"]');
  const directMarcheTypes = await page.$('aside a[href="/admin/marche-types"]');
  if (directTypesDoc) throw new Error('Item sidebar /admin/types-documents toujours présent (devrait être hub)');
  if (directMarcheTypes) throw new Error('Item sidebar /admin/marche-types toujours présent');
});

// =============================================================================
// F1c — /admin/parametres hub avec 4 cards
// =============================================================================
await test('F1c /admin/parametres hub : 4 cards', async () => {
  await page.goto(`${URL_BASE}/admin/parametres`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_parametres_hub.png`, fullPage: true });
  const links = await page.$$eval('a[href^="/admin/"]', (as) => as.map((a) => a.getAttribute('href')));
  for (const h of ['/admin/types-documents', '/admin/document-categories', '/admin/marche-types', '/admin/supplier-types']) {
    if (!links.includes(h)) throw new Error(`Card "${h}" absente du hub`);
  }
});

// =============================================================================
// F2 — Supplier types CRUD
// =============================================================================
await test('F2a /admin/supplier-types : 10 seeds visibles', async () => {
  await page.goto(`${URL_BASE}/admin/supplier-types`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_supplier_types_list.png`, fullPage: true });
  const labels = await page.$$eval('table tbody tr td:nth-of-type(2)', (tds) => tds.map((td) => td.textContent.trim()));
  const expected = ['Notaire', 'Banque', 'Juridique', 'Comptabilité', 'Architecte', 'Entrepreneur', 'Syndic', 'Diagnostic', 'Assurance', 'Autre'];
  const missing = expected.filter((e) => !labels.includes(e));
  if (missing.length) throw new Error(`Seeds manquants : ${missing.join(', ')}. Trouvés : ${JSON.stringify(labels)}`);
});

await test('F2b /admin/supplier-types form create présent', async () => {
  const codeInput = await page.$('input[name="code"]');
  const labelInput = await page.$('input[name="label"]');
  if (!codeInput || !labelInput) throw new Error('Form create absent');
});

await test('F2c /admin/supplier-types/[id]/edit accessible', async () => {
  const editHref = await page.$eval('table tbody tr:first-child a[href*="/admin/supplier-types/"][href$="/edit"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${editHref}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  const labelInput = await page.$('input[name="label"]');
  const readonly = await page.$('input[readonly]');
  if (!labelInput) throw new Error('Input label absent');
  if (!readonly) throw new Error('Input code readonly absent');
});

// =============================================================================
// F3 — Document categories CRUD
// =============================================================================
await test('F3a /admin/document-categories : 6 seeds visibles', async () => {
  await page.goto(`${URL_BASE}/admin/document-categories`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_doc_categories_list.png`, fullPage: true });
  const labels = await page.$$eval('table tbody tr td:nth-of-type(2)', (tds) => tds.map((td) => td.textContent.trim()));
  const expected = ['Notaire', 'Banque', 'Juridique', 'Comptabilité', 'Courant', 'Location'];
  const missing = expected.filter((e) => !labels.includes(e));
  if (missing.length) throw new Error(`Seeds manquants : ${missing.join(', ')}. Trouvés : ${JSON.stringify(labels)}`);
});

await test('F3b /admin/document-categories form create présent', async () => {
  const codeInput = await page.$('input[name="code"]');
  const labelInput = await page.$('input[name="label"]');
  if (!codeInput || !labelInput) throw new Error('Form create absent');
});

// =============================================================================
// K1 — Doc-type form : select supplierTypeId + categoryId FK
// =============================================================================
await test('K1a /admin/types-documents create : select categoryId (FK)', async () => {
  await page.goto(`${URL_BASE}/admin/types-documents`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_types_documents_create.png`, fullPage: true });
  const sel = await page.$('select[name="categoryId"]');
  if (!sel) throw new Error('select[name="categoryId"] absent (form create)');
  const opts = await page.$$eval('select[name="categoryId"] option', (os) => os.map((o) => o.textContent.trim()));
  if (opts.length < 7) throw new Error(`Options categoryId attendues 7+ (— Aucune — + 6 seeds), trouvé ${opts.length} : ${JSON.stringify(opts)}`);
});

await test('K1b /admin/types-documents create : select supplierTypeId présent', async () => {
  const sel = await page.$('select[name="supplierTypeId"]');
  if (!sel) throw new Error('select[name="supplierTypeId"] absent (form create)');
  const opts = await page.$$eval('select[name="supplierTypeId"] option', (os) => os.map((o) => o.textContent.trim()));
  if (opts.length < 11) throw new Error(`Options supplierTypeId attendues 11+ (— Tous — + 10 seeds), trouvé ${opts.length}`);
});

await test('K1c /admin/types-documents/[id]/edit : selects FK présents', async () => {
  const editHref = await page.$eval('table tbody tr a[href*="/admin/types-documents/"][href$="/edit"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${editHref}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  const catSel = await page.$('select[name="categoryId"]');
  const supSel = await page.$('select[name="supplierTypeId"]');
  if (!catSel) throw new Error('select categoryId absent (edit)');
  if (!supSel) throw new Error('select supplierTypeId absent (edit)');
});

// =============================================================================
// Console JS propre
// =============================================================================
await test('Console JS propre (ignore prefetch RSC)', async () => {
  const filtered = consoleErrors.filter((e) =>
    !/favicon/i.test(e) &&
    !/Failed to fetch RSC payload/i.test(e) &&
    !/404 \(Not Found\)/i.test(e)
  );
  if (filtered.length > 0) {
    fs.writeFileSync(`${ARTIFACTS}/${TS}_console.txt`, filtered.join('\n'));
    throw new Error(`${filtered.length} erreur(s). Premier : ${filtered[0]}`);
  }
});

const pass = results.filter((r) => r.startsWith('PASS')).length;
const fail = results.filter((r) => r.startsWith('FAIL')).length;
const report = `Smoke V12bis PR2 — ${TS}\n${results.join('\n')}\n\n${pass} PASS / ${fail} FAIL`;
fs.writeFileSync(`${ARTIFACTS}/${TS}_report_pr2.txt`, report);
console.log(`\n${report}`);
console.log(`📁 Artifacts: ${ARTIFACTS}`);

await browser.close();
process.exit(fail > 0 ? 1 : 0);
