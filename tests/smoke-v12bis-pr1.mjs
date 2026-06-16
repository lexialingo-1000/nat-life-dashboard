// Smoke V12bis PR1 quickwins contre prod.
// Couvre A5 (déjà OK), B1, C1, D2, E1, E2, H1, H3 (déjà OK), I1, J3, C2.
//
// Auth: storage state reuse, sinon OTP via gws Gmail lexialingo (fallback fichier).
//
// Run: NATLIFE_EMAIL=lexialingo@gmail.com node Apps/nat-life/tests/smoke-v12bis-pr1.mjs

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
    const mjsCandidate = cjsPath.replace(/index\.(c?js)$/, 'index.mjs');
    if (fs.existsSync(mjsCandidate)) return mjsCandidate;
    return cjsPath;
  } catch {}
  return '/Users/JC/dev/test-github/node_modules/playwright/index.mjs';
}
const playwrightPath = resolvePlaywright();
const playwrightURL = playwrightPath.startsWith('/') ? pathToFileURL(playwrightPath).href : playwrightPath;
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

// =============================================================================
// Auth: session reuse OR OTP via gws Gmail
// =============================================================================
let sessionValid = false;
try {
  const probe = await page.goto(`${URL_BASE}/societes`, { waitUntil: 'networkidle', timeout: 25000 });
  if (probe && probe.status() === 200 && !page.url().includes('/login')) {
    sessionValid = true;
    console.log(`✅ Session reuse OK`);
  }
} catch {}

if (!sessionValid) {
  console.log('=== Phase 1: submit email ===');
  if (fs.existsSync(OTP_FILE)) fs.unlinkSync(OTP_FILE);
  await page.goto(`${URL_BASE}/login`, { waitUntil: 'networkidle', timeout: 25000 });
  await page.fill('input[type="email"]', EMAIL);
  const sentAtMs = Date.now() - 5000;
  await page.click('button[type="submit"]');
  await page.waitForSelector('input[name="token"], input[name="code"], input[inputmode="numeric"]', { timeout: 15000 });
  console.log(`📧 OTP envoyé à ${EMAIL}, attente via gws (max 90s)...`);

  // Phase 2: poll gws Gmail (only messages newer than sentAtMs - margin)
  const POLL_TIMEOUT_MS = 180 * 1000;
  const POLL_INTERVAL_MS = 5000;
  const FRESHNESS_FLOOR = sentAtMs - 20 * 1000;
  let waited = 0;
  let otp = null;
  function extractOtpFromGmail() {
    try {
      const listOut = execSync(`gws gmail users messages list --params '{"userId":"me","q":"from:noreply@fka-holding.com newer_than:1h","maxResults":5}' --format json 2>/dev/null`, { encoding: 'utf8', timeout: 20000 });
      const list = JSON.parse(listOut || '{}');
      const msgs = list.messages || [];
      for (const m of msgs) {
        const detailOut = execSync(`gws gmail users messages get --params '{"userId":"me","id":"${m.id}","format":"full"}' --format json 2>/dev/null`, { encoding: 'utf8', timeout: 15000 });
        const parsed = JSON.parse(detailOut);
        const internalDate = Number(parsed.internalDate || 0);
        if (internalDate < FRESHNESS_FLOOR) continue;
        // Decode body
        function walk(p, acc) {
          if (p?.body?.data) {
            try { acc.push(Buffer.from(p.body.data, 'base64').toString('utf8')); } catch {}
          }
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
    otp = extractOtpFromGmail();
    if (otp) break;
    if (fs.existsSync(OTP_FILE)) {
      const code = fs.readFileSync(OTP_FILE, 'utf8').trim();
      if (code.length >= 6) { otp = code; break; }
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    waited += POLL_INTERVAL_MS;
  }
  console.log('');
  if (!otp) { console.log('❌ Timeout OTP. Mets le code dans /tmp/natlife-otp-code et relance.'); process.exit(1); }
  console.log(`✅ OTP reçu: ${otp}`);

  const otpInput = await page.$('input[name="token"], input[name="code"], input[inputmode="numeric"]');
  await otpInput.fill(otp);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 });
  await context.storageState({ path: STORAGE_STATE });
  console.log(`💾 Session sauvée`);
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'networkidle', timeout: 25000 });
}

// =============================================================================
// J3 — Breadcrumb visible sur pages dashboard
// =============================================================================
await test('J3 Breadcrumb visible sur /societes', async () => {
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'networkidle' });
  const nav = await page.$('nav[aria-label="Fil d\'Ariane"]');
  if (!nav) throw new Error('nav[aria-label="Fil d\'Ariane"] absent');
  const text = (await nav.textContent()) || '';
  if (!text.toLowerCase().includes('sociétés')) throw new Error(`breadcrumb sans "Sociétés": "${text.trim()}"`);
});

// =============================================================================
// E1 + E2 — Liste biens : Lot 1ère col + tri alpha
// =============================================================================
await test('E1 /biens — Lot = 1ère col data', async () => {
  await page.goto(`${URL_BASE}/biens`, { waitUntil: 'networkidle' });
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  const headers = await page.$$eval('table thead th button', (btns) =>
    btns.map((b) => b.textContent.trim()).filter((t) => t.length > 0)
  );
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_biens_list.png`, fullPage: true });
  if (!headers[0]?.toLowerCase().includes('lot')) {
    throw new Error(`1ère col data = "${headers[0]}". All: ${JSON.stringify(headers)}`);
  }
  if (!headers[1]?.toLowerCase().includes('bien')) {
    throw new Error(`2ème col data = "${headers[1]}". All: ${JSON.stringify(headers)}`);
  }
});

await test('E2 /biens tri alpha défaut sur Lot', async () => {
  // Première colonne data (Lot), index nth-of-type(2) car col 1 = checkbox.
  const lots = await page.$$eval('table tbody tr td:nth-of-type(2)', (tds) =>
    tds.map((td) => td.textContent.trim()).filter((t) => t && !t.startsWith('+'))
  );
  if (lots.length < 2) throw new Error(`Pas assez de lots pour vérifier tri (${lots.length})`);
  const sorted = [...lots].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  for (let i = 0; i < lots.length; i++) {
    if (lots[i] !== sorted[i]) {
      throw new Error(`Tri non alpha: rendu[${i}]="${lots[i]}" attendu="${sorted[i]}". Liste: ${JSON.stringify(lots.slice(0, 5))}`);
    }
  }
});

// =============================================================================
// B1 — Fiche fournisseur onglet "Compta" (ex "Factures")
// =============================================================================
await test('B1 /fournisseurs/[id] onglet "Compta"', async () => {
  await page.goto(`${URL_BASE}/fournisseurs`, { waitUntil: 'networkidle' });
  const firstHref = await page.$eval('table tbody tr:first-child a[href^="/fournisseurs/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${firstHref}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_fournisseur_tabs.png`, fullPage: true });
  const tabsText = await page.$$eval('[role="tab"], button[data-tab], nav[aria-label*="onglet" i] *', (els) =>
    els.map((e) => (e.textContent || '').trim()).filter(Boolean)
  );
  // fallback: any button or link text
  const allTexts = tabsText.length ? tabsText : await page.$$eval('button, a', (els) => els.map((e) => (e.textContent || '').trim()));
  if (!allTexts.some((t) => /^compta(\s|$)/i.test(t))) {
    throw new Error(`Onglet "Compta" absent. Tabs: ${JSON.stringify(tabsText.slice(0, 15))}`);
  }
  if (allTexts.some((t) => t === 'Factures')) {
    throw new Error('Onglet "Factures" toujours présent');
  }
});

// =============================================================================
// C1 — Fiche bien : pas d'onglet "Plans"
// =============================================================================
await test('C1 /biens/properties/[id] pas d\'onglet Plans', async () => {
  await page.goto(`${URL_BASE}/biens`, { waitUntil: 'networkidle' });
  const propHref = await page.$eval('table tbody tr a[href^="/biens/properties/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${propHref}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_property_tabs.png`, fullPage: true });
  const tabs = await page.$$eval('button, a', (els) => els.map((e) => (e.textContent || '').trim()));
  if (tabs.some((t) => t === 'Plans')) {
    throw new Error('Onglet "Plans" toujours présent');
  }
});

// =============================================================================
// D2 — Form édition lot pas de Surface Boutin
// =============================================================================
await test('D2 /biens/lots/[id]/edit Surface Boutin caché', async () => {
  await page.goto(`${URL_BASE}/biens`, { waitUntil: 'networkidle' });
  const lotHref = await page.$eval('table tbody tr a[href^="/biens/lots/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${lotHref}/edit`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_lot_edit.png`, fullPage: true });
  const labels = await page.$$eval('label', (ls) => ls.map((l) => l.textContent.trim()));
  if (labels.some((l) => l.toLowerCase().includes('boutin'))) {
    throw new Error(`Label "Surface Boutin" toujours visible: ${JSON.stringify(labels)}`);
  }
  // Hidden input doit exister (préserve valeur)
  const hidden = await page.$('input[type="hidden"][name="surfaceBoutin"]');
  if (!hidden) throw new Error('Hidden input surfaceBoutin manquant — valeur DB risque écrasement');
});

// =============================================================================
// C2 — Form bien : statut sans Loué/Vacant
// =============================================================================
await test('C2 /biens/properties/[id]/edit select statut sans Loué/Vacant', async () => {
  await page.goto(`${URL_BASE}/biens`, { waitUntil: 'networkidle' });
  const propHref = await page.$eval('table tbody tr a[href^="/biens/properties/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${propHref}/edit`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_property_edit.png`, fullPage: true });
  // Si statut legacy (loue/vacant), le champ devient un input disabled — accepter ce cas
  const select = await page.$('select[name="statut"]');
  if (select) {
    const opts = await page.$$eval('select[name="statut"] option', (os) => os.map((o) => ({ value: o.value, label: (o.textContent || '').trim() })));
    if (opts.some((o) => o.value === 'loue' || o.value === 'vacant')) {
      throw new Error(`Options loue/vacant toujours présentes: ${JSON.stringify(opts)}`);
    }
    if (!opts.some((o) => o.label.toLowerCase().includes('portefeuille'))) {
      throw new Error(`Label "En portefeuille" absent: ${JSON.stringify(opts)}`);
    }
  } else {
    // legacy case — vérifier hidden + input readonly
    const legacy = await page.$('input[type="hidden"][name="statut"]');
    if (!legacy) throw new Error('Ni select ni hidden statut');
  }
});

// =============================================================================
// I1 — Form édition marché : pas Date du devis / Date de signature
// =============================================================================
await test('I1 /marches/[id]/edit pas Date devis/signature visible', async () => {
  await page.goto(`${URL_BASE}/marches`, { waitUntil: 'networkidle' });
  const marcheHref = await page.$eval('table tbody tr a[href^="/marches/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${marcheHref}/edit`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_marche_edit.png`, fullPage: true });
  const labels = await page.$$eval('label', (ls) => ls.map((l) => l.textContent.trim().toLowerCase()));
  if (labels.some((l) => l === 'date du devis')) throw new Error('Label "Date du devis" toujours visible');
  if (labels.some((l) => l === 'date de signature')) throw new Error('Label "Date de signature" toujours visible');
  // Hidden inputs préservent les valeurs
  const hd1 = await page.$('input[type="hidden"][name="dateDevis"]');
  const hd2 = await page.$('input[type="hidden"][name="dateSignature"]');
  if (!hd1) throw new Error('Hidden dateDevis manquant');
  if (!hd2) throw new Error('Hidden dateSignature manquant');
});

// =============================================================================
// H1 — Table Compta société : header "Date document"
// =============================================================================
await test('H1 /societes/[id] onglet Compta header "Date document"', async () => {
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'networkidle' });
  const socHref = await page.$eval('table tbody tr a[href^="/societes/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${socHref}`, { waitUntil: 'networkidle' });
  // Cliquer onglet Compta — texte 'Compta' visible
  const comptaTab = await page.$('button:has-text("Compta"), a:has-text("Compta")');
  if (comptaTab) await comptaTab.click().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_societe_compta.png`, fullPage: true });
  const headers = await page.$$eval('table thead th button, table thead th', (els) =>
    els.map((e) => (e.textContent || '').trim()).filter(Boolean)
  );
  if (!headers.some((h) => h.toLowerCase().includes('date document'))) {
    throw new Error(`Header "Date document" absent. Headers: ${JSON.stringify(headers.slice(0, 20))}`);
  }
});

// =============================================================================
// Console errors (signal qualité)
// =============================================================================
await test('Console JS propre (0 erreur hors favicon)', async () => {
  const filtered = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e));
  if (filtered.length > 0) {
    fs.writeFileSync(`${ARTIFACTS}/${TS}_console_errors.txt`, filtered.join('\n'));
    throw new Error(`${filtered.length} erreur(s) JS. Premier: ${filtered[0]}`);
  }
});

// =============================================================================
// Report
// =============================================================================
const pass = results.filter((r) => r.startsWith('PASS')).length;
const fail = results.filter((r) => r.startsWith('FAIL')).length;
const report = `Smoke V12bis PR1 — ${TS}\n${results.join('\n')}\n\n${pass} PASS / ${fail} FAIL`;
fs.writeFileSync(`${ARTIFACTS}/${TS}_report.txt`, report);
console.log(`\n${report}`);
console.log(`\n📁 Artifacts: ${ARTIFACTS}`);

await browser.close();
process.exit(fail > 0 ? 1 : 0);
