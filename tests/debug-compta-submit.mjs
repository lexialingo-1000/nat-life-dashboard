// Debug : capture toutes les requêtes pendant le submit Marché → Compta
// pour comprendre pourquoi le server action renvoie /login.

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const cjsPath = require.resolve('playwright');
const mjsCandidate = cjsPath.replace(/index\.(c?js)$/, 'index.mjs');
const playwrightPath = fs.existsSync(mjsCandidate) ? mjsCandidate : cjsPath;
const playwrightURL = pathToFileURL(playwrightPath).href;
const { chromium } = await import(playwrightURL);

const ARTIFACTS = '/tmp/natlife-qa';
const STORAGE_STATE = path.join(ARTIFACTS, 'storage-state.json');
const URL_BASE = 'https://dashboard.fka-holding.com';
const TEST_FILE = path.join(ARTIFACTS, 'smoke-test-doc.pdf');

const EMAIL = 'lexialingo@gmail.com';
const OTP_FILE = '/tmp/natlife-otp-code';

const browser = await chromium.launch({ headless: true });
const contextOpts = { viewport: { width: 1920, height: 1080 } };
if (fs.existsSync(STORAGE_STATE)) contextOpts.storageState = STORAGE_STATE;
const context = await browser.newContext(contextOpts);
const page = await context.newPage();

// Login OTP si pas de session valide
let sessionValid = false;
if (contextOpts.storageState) {
  try {
    const probe = await page.goto(`${URL_BASE}/societes`, { waitUntil: 'networkidle', timeout: 15000 });
    if (probe && probe.status() === 200 && !page.url().includes('/login')) {
      sessionValid = true;
      console.log(`✅ Session OK`);
    }
  } catch {}
}
if (!sessionValid) {
  if (fs.existsSync(OTP_FILE)) fs.unlinkSync(OTP_FILE);
  await page.goto(`${URL_BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.click('button[type="submit"]');
  await page.waitForSelector('input[name="token"], input[name="code"], input[inputmode="numeric"]', { timeout: 15000 });
  console.log(`📧 OTP envoyé`);
  let waited = 0;
  let otp = null;
  while (waited < 300000) {
    if (fs.existsSync(OTP_FILE)) {
      otp = fs.readFileSync(OTP_FILE, 'utf8').trim();
      if (otp.length >= 6) break;
    }
    await new Promise((r) => setTimeout(r, 2000));
    waited += 2000;
  }
  if (!otp) { console.log('❌ Timeout OTP'); process.exit(1); }
  await page.locator('input[name="token"], input[name="code"], input[inputmode="numeric"]').first().fill(otp);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 });
  await context.storageState({ path: STORAGE_STATE });
  console.log(`✅ Logged in`);
}

const requests = [];
page.on('request', (req) => {
  const m = req.method();
  if (m !== 'GET') {
    const url = req.url();
    const headers = req.headers();
    requests.push({
      type: 'REQ',
      method: m,
      url,
      hasNextAction: !!headers['next-action'],
      contentType: headers['content-type'],
      ts: Date.now(),
    });
  }
});
page.on('response', async (resp) => {
  const req = resp.request();
  if (req.method() === 'GET') return;
  const url = resp.url();
  const status = resp.status();
  let body = '';
  try {
    const ct = resp.headers()['content-type'] || '';
    if (ct.includes('json') || ct.includes('text') || ct.includes('html')) {
      const buf = await resp.body().catch(() => null);
      body = buf ? buf.toString('utf8').slice(0, 400) : '';
    }
  } catch {}
  requests.push({
    type: 'RESP',
    method: req.method(),
    url,
    status,
    location: resp.headers()['location'] || null,
    body,
    ts: Date.now(),
  });
});

// Nav fiche marché
await page.goto(`${URL_BASE}/marches`, { waitUntil: 'networkidle' });
const link = await page.$('main table tbody tr a[href^="/marches/"]');
if (!link) { console.log('NO MARCHE'); process.exit(1); }
const href = await link.getAttribute('href');
console.log(`Marché: ${href}`);
await page.goto(`${URL_BASE}${href}`, { waitUntil: 'networkidle' });

// Ouvre onglet Compta
await page.locator('main button:has-text("Compta")').first().click();
await page.waitForTimeout(500);

// Click "Nouveau devis"
await page.locator('main button:has-text("Nouveau devis")').first().click();
await page.waitForTimeout(500);

// Société: select premier non-vide
const companySelect = page.locator('form select').first();
const opts = await companySelect.locator('option').allTextContents();
const idx = opts.findIndex((o, i) => i > 0 && !o.startsWith('—'));
const val = await companySelect.locator('option').nth(idx).getAttribute('value');
await companySelect.selectOption(val);
console.log(`Société choisie: ${opts[idx]}`);

// File
await page.locator('form input[type="file"]').first().setInputFiles(TEST_FILE);

// Name
const name = `DEBUG-${Date.now()}`;
await page.locator('form input[placeholder*="2026"], form input[placeholder*="travaux"]').first().fill(name);
console.log(`Name: ${name}`);

// Reset requests buffer juste avant submit
requests.length = 0;
const beforeSubmit = Date.now();

// Submit
console.log('--- SUBMIT ---');
await page.locator('form button[type="submit"]').first().click();

// Wait for either form close OR error OR navigation
await page.waitForTimeout(8000);

console.log(`\nURL final: ${page.url()}`);
console.log(`\n--- Requests pendant submit (${requests.length}) ---`);
for (const r of requests) {
  const t = ((r.ts - beforeSubmit) / 1000).toFixed(2);
  if (r.type === 'REQ') {
    console.log(`[+${t}s] REQ ${r.method} ${r.url.replace(URL_BASE, '')} nextAction=${r.hasNextAction} ct=${r.contentType}`);
  } else {
    console.log(`[+${t}s] RESP ${r.status} ${r.method} ${r.url.replace(URL_BASE, '')}${r.location ? ` → ${r.location}` : ''}`);
    if (r.body) console.log(`        body: ${r.body.replace(/\n/g, ' | ').slice(0, 250)}`);
  }
}

await page.screenshot({ path: `${ARTIFACTS}/debug-after-submit.png`, fullPage: true });
await browser.close();
process.exit(0);
