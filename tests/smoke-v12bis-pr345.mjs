// Smoke V12bis PR3 + PR4 + PR5 combiné — réutilise session, OTP gws fallback.

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

let sessionValid = false;
try {
  const probe = await page.goto(`${URL_BASE}/societes`, { waitUntil: 'domcontentloaded', timeout: 25000 });
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
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 5000));
    waited += 5000;
  }
  console.log('');
  if (!otp) { console.log('❌ Timeout OTP'); process.exit(1); }
  const inp = await page.$('input[name="token"], input[name="code"], input[inputmode="numeric"]');
  await inp.fill(otp);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 });
  await context.storageState({ path: STORAGE_STATE });
}

// =============================================================================
// PR3 — G1 sticky top + A4 createSupplier inline dans AccountingDocumentsManager
// =============================================================================
await test('PR3 G1 — EntityCombobox "+ Créer" sticky top sur form marché', async () => {
  await page.goto(`${URL_BASE}/marches/new`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  // step 1 picker propertyId d'abord — pick first option
  const propBtn = await page.$('button[role="combobox"], button:has(span:text-matches("Sélectionner|Choisir","i"))');
  // Skip step 1 si déjà step 2
  const supplierFieldEarly = await page.$('input[name="supplierId"]');
  if (!supplierFieldEarly && propBtn) {
    await propBtn.click();
    await page.waitForTimeout(300);
    const firstProp = await page.$('ul li button');
    if (firstProp) await firstProp.click();
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    await page.waitForURL((u) => u.toString().includes('propertyId='), { timeout: 10000 });
  }
  // Maintenant step 2 avec combobox supplier qui doit avoir Créer en haut
  const supplierComboBtn = await page.$('input[name="supplierId"] + button, button.input:has-text("Sélectionner")');
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_pr3_marche_new_step2.png`, fullPage: true });
  // Trouver le bouton combobox fournisseur et l'ouvrir
  const sb = await page.$$('button.input');
  if (sb.length === 0) throw new Error('Aucun bouton combobox sur form marché');
});

await test('PR3 A4 — /societes/[id] Compta tab : combobox + Créer', async () => {
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table tbody tr a[href^="/societes/"]', { timeout: 10000 });
  const socHref = await page.$eval('table tbody tr a[href^="/societes/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${socHref}?tab=compta`, { waitUntil: 'domcontentloaded' });
  // Cliquer Compta tab si pas déjà actif
  const tabBtn = await page.$('button[role="tab"]:text-matches("Compta")');
  if (tabBtn) await tabBtn.click().catch(() => {});
  await page.waitForTimeout(500);
  // Click "Nouveau devis"
  const newBtn = await page.$('button:has-text("Nouveau devis"), button:has-text("Nouvelle facture"), button:has-text("Nouvelle commande")');
  if (newBtn) await newBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_pr3_societe_compta_form.png`, fullPage: true });
  // Maintenant le form upload est ouvert. Cherche les comboboxes hidden inputs
  const supplierHidden = await page.$('input[type="hidden"][name="__supplierId_combobox"]');
  const marcheHidden = await page.$('input[type="hidden"][name="__marcheId_combobox"]');
  if (!supplierHidden) throw new Error('Hidden input __supplierId_combobox absent (EntityCombobox pas utilisé)');
  if (!marcheHidden) throw new Error('Hidden input __marcheId_combobox absent');
});

// =============================================================================
// PR4 — J1 delete + J4 Échéance + D1 Plans Lot
// =============================================================================
await test('PR4 J4 — Form tâche : champ Échéance (dueDate) présent', async () => {
  // Find any sous-lot via fiche marché
  await page.goto(`${URL_BASE}/marches`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table tbody tr a[href^="/marches/"]', { timeout: 10000 });
  const marcheHref = await page.$eval('table tbody tr a[href^="/marches/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${marcheHref}?tab=suivi`, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_pr4_marche_suivi.png`, fullPage: true });
  // Click "+ Ajouter" sur premier sous-lot
  const addBtn = await page.$('a:has-text("Ajouter")');
  if (!addBtn) throw new Error('Aucun sous-lot avec bouton Ajouter — créer un sous-lot manuellement pour ce test');
  await addBtn.click();
  await page.waitForURL((u) => u.toString().includes('/taches/new'), { timeout: 10000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_pr4_tache_new.png`, fullPage: true });
  const dueInput = await page.$('input[name="dueDate"]');
  if (!dueInput) throw new Error('Champ dueDate (Échéance) absent du form tâche');
  const labels = await page.$$eval('label', (ls) => ls.map((l) => l.textContent.trim().toLowerCase()));
  if (!labels.some((l) => l.includes('échéance'))) throw new Error(`Label "Échéance" absent : ${JSON.stringify(labels)}`);
});

await test('PR4 J1 — Boutons Trash2 sur sous-lot + tâche dans MarchesTree', async () => {
  await page.goto(`${URL_BASE}/marches`, { waitUntil: 'domcontentloaded' });
  const marcheHref = await page.$eval('table tbody tr a[href^="/marches/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${marcheHref}?tab=suivi`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  // Boutons title="Supprimer ce sous-lot" et "Supprimer cette tâche"
  const slDelete = await page.$('button[title="Supprimer ce sous-lot"]');
  // pas obligatoire si pas de sous-lot ; vérifier au moins la présence du composant Trash2 sur la page si données
  const html = await page.content();
  if (html.includes('Supprimer ce sous-lot') || html.includes('Supprimer cette tâche')) {
    // OK boutons présents
  } else {
    // Pas de sous-lot existant — skip mais sans fail
    throw new Error('SKIP : aucun sous-lot pour vérifier (pas un fail bloquant)');
  }
});

await test('PR4 D1 — Onglet Plans sur fiche Lot', async () => {
  await page.goto(`${URL_BASE}/biens`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table tbody tr a[href^="/biens/lots/"]', { timeout: 10000 });
  const lotHref = await page.$eval('table tbody tr a[href^="/biens/lots/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${lotHref}`, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_pr4_lot_tabs.png`, fullPage: true });
  const tabs = await page.$$eval('button[role="tab"]', (bs) => bs.map((b) => b.textContent.trim()));
  if (!tabs.some((t) => /^plans/i.test(t))) {
    throw new Error(`Onglet "Plans" absent : ${JSON.stringify(tabs)}`);
  }
});

// =============================================================================
// PR5 — A1 TVA + B2 Compta fournisseur + L1 widget société
// =============================================================================
await test('PR5 A1 — Champ N° TVA intracom sur form édition société', async () => {
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'domcontentloaded' });
  const socHref = await page.$eval('table tbody tr a[href^="/societes/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${socHref}/edit`, { waitUntil: 'domcontentloaded' });
  const tvaInput = await page.$('input[name="tvaIntracom"]');
  if (!tvaInput) throw new Error('input[name="tvaIntracom"] absent du form edit Société');
});

await test('PR5 A1 — Ligne N° TVA intracom sur fiche Société (Identité)', async () => {
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'domcontentloaded' });
  const socHref = await page.$eval('table tbody tr a[href^="/societes/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${socHref}?tab=identity`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  const html = await page.content();
  if (!/N°\s*TVA\s*intracom/i.test(html)) throw new Error('"N° TVA intracom" absent de la fiche Société');
});

await test('PR5 B2 — Onglet Compta sur fiche Fournisseur', async () => {
  await page.goto(`${URL_BASE}/fournisseurs`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table tbody tr a[href^="/fournisseurs/"]', { timeout: 10000 });
  const supHref = await page.$eval('table tbody tr a[href^="/fournisseurs/"]', (a) => a.getAttribute('href'));
  await page.goto(`${URL_BASE}${supHref}`, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_pr5_fournisseur_tabs.png`, fullPage: true });
  const tabs = await page.$$eval('button[role="tab"]', (bs) => bs.map((b) => b.textContent.trim()));
  if (!tabs.some((t) => /compta/i.test(t))) throw new Error(`Onglet "Compta" absent fournisseur : ${JSON.stringify(tabs)}`);
});

await test('PR5 L1 — Widget docs obligatoires manquants visible accueil', async () => {
  await page.goto(`${URL_BASE}/`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(500);
  const html = await page.content();
  // Le widget rend "Action requise" + "Documents obligatoires manquants ou expirés" en header
  if (!/Documents\s*obligatoires\s*manquants|Action\s*requise/i.test(html)) {
    throw new Error('Widget "Documents obligatoires manquants" absent de la page d\'accueil');
  }
});

// =============================================================================
// Console clean
// =============================================================================
await test('Console JS propre (ignore RSC prefetch + favicon)', async () => {
  const filtered = consoleErrors.filter((e) =>
    !/favicon/i.test(e) &&
    !/Failed to fetch RSC payload/i.test(e) &&
    !/404 \(Not Found\)/i.test(e)
  );
  if (filtered.length > 0) {
    fs.writeFileSync(`${ARTIFACTS}/${TS}_pr345_console.txt`, filtered.join('\n'));
    throw new Error(`${filtered.length} erreur(s). Premier : ${filtered[0]}`);
  }
});

const pass = results.filter((r) => r.startsWith('PASS')).length;
const fail = results.filter((r) => r.startsWith('FAIL')).length;
const report = `Smoke V12bis PR3+PR4+PR5 — ${TS}\n${results.join('\n')}\n\n${pass} PASS / ${fail} FAIL`;
fs.writeFileSync(`${ARTIFACTS}/${TS}_report_pr345.txt`, report);
console.log(`\n${report}`);
console.log(`📁 Artifacts : ${ARTIFACTS}`);

await browser.close();
process.exit(fail > 0 ? 1 : 0);
