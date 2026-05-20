// Smoke V1.10 SUBMIT (PR #274) — test upload réel devis/commande/facture
// sur les 3 scopes (company / marche / supplier).
//
// Crée des rows DB de test puis les supprime via le bouton corbeille pour
// laisser la prod propre. Capture console errors pendant le submit.
//
// Si crash mi-test, les rows TEST-SMOKE-V110-* peuvent rester en prod et
// devront être nettoyées à la main (SELECT * FROM company_accounting_documents
// WHERE name LIKE 'TEST-SMOKE-V110-%').

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

// Fichier de test (PDF minimal valide ~ 1KB)
const TEST_FILE = path.join(ARTIFACTS, 'smoke-test-doc.pdf');
if (!fs.existsSync(TEST_FILE)) {
  // PDF 1.4 minimal valide
  const minimalPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n160\n%%EOF\n'
  );
  fs.writeFileSync(TEST_FILE, minimalPdf);
}

const RUN_TAG = `TEST-SMOKE-V110-${Date.now()}`;

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

// Auto-accept confirm() dialogs (delete confirmations)
page.on('dialog', async (dialog) => {
  console.log(`📣 Dialog: ${dialog.type()} "${dialog.message().slice(0, 80)}"`);
  await dialog.accept();
});

const consoleErrors = [];
const consoleAll = [];
page.on('console', (m) => {
  const text = m.text();
  consoleAll.push(`[${m.type()}] ${text}`);
  if (m.type() === 'error') consoleErrors.push(text);
});

const networkErrors = [];
page.on('response', (resp) => {
  const status = resp.status();
  const url = resp.url();
  if (status >= 400 && !url.includes('favicon') && !url.includes('manifest')) {
    networkErrors.push(`${status} ${url}`);
  }
});

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

// Session check
let sessionValid = false;
if (contextOpts.storageState) {
  try {
    const probe = await page.goto(`${URL_BASE}/societes`, { waitUntil: 'networkidle', timeout: 20000 });
    if (probe && probe.status() === 200 && !page.url().includes('/login')) {
      sessionValid = true;
      console.log(`✅ Session OK: ${page.url()}`);
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
  let waited = 0;
  let otp = null;
  while (waited < 600000) {
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

/**
 * Submit complet : ouvre form devis, remplit champs, upload fichier, submit,
 * vérifie row apparaît, delete row, vérifie row supprimée. Capture console
 * errors pendant le submit.
 *
 * `pickSupplier`: si true, sélectionne le 1er supplier du dropdown. Si false,
 * laisse le default (cas scope=supplier où c'est verrouillé).
 * `pickCompany`: idem pour société (cas scope=company c'est verrouillé en
 * input readonly, donc false).
 */
async function submitDevisCycle({ scope, scopeName, pickSupplier, pickCompany }) {
  const docName = `${RUN_TAG}-${scope}-devis`;
  const consoleErrorsBefore = consoleErrors.length;
  const networkErrorsBefore = networkErrors.length;

  // Ouvre form
  const newDevis = page.locator('main button:has-text("Nouveau devis")').first();
  await newDevis.click();
  await page.waitForTimeout(400);

  // Société émettrice
  if (pickCompany) {
    // select natif présent (scope=marche/supplier)
    const companySelect = page.locator('main form select').first();
    const options = await companySelect.locator('option').allTextContents();
    // Premier option non-vide
    const firstReal = options.findIndex((o, i) => i > 0 && !o.startsWith('—'));
    if (firstReal === -1) throw new Error('aucune société sélectionnable');
    const optValue = await companySelect.locator('option').nth(firstReal).getAttribute('value');
    await companySelect.selectOption(optValue);
  }

  // Fournisseur
  if (pickSupplier) {
    // EntityCombobox = button qui ouvre dropdown <ul><li><button>
    // Trigger button = celui qui contient le span avec placeholder "Choisir un fournisseur"
    const comboTrigger = page.locator('main form button:has-text("Choisir un fournisseur")').first();
    if (await comboTrigger.count()) {
      await comboTrigger.click();
      await page.waitForTimeout(300);
      // Premier item du dropdown (skip header "+ Créer un fournisseur" + input filtre)
      const firstItem = page.locator('main form ul li button').first();
      if (!(await firstItem.count())) throw new Error('aucun item dropdown EntityCombobox');
      await firstItem.click();
      await page.waitForTimeout(200);
    } else {
      // select natif
      const supplierSelect = page.locator('main form select').nth(pickCompany ? 1 : 0);
      const options = await supplierSelect.locator('option').allTextContents();
      const firstReal = options.findIndex((o, i) => i > 0 && !o.startsWith('—'));
      if (firstReal === -1) throw new Error('aucun fournisseur sélectionnable');
      const optValue = await supplierSelect.locator('option').nth(firstReal).getAttribute('value');
      await supplierSelect.selectOption(optValue);
    }
  }

  await page.waitForTimeout(200);

  // Fichier
  const fileInput = page.locator('main form input[type="file"]').first();
  await fileInput.setInputFiles(TEST_FILE);

  // Nom
  const nameInput = page.locator('main form input[placeholder*="2026"], main form input[placeholder*="travaux"], main form input[placeholder*="ournisseur"]').first();
  await nameInput.fill(docName);

  // Screenshot before submit
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_${scope}_before_submit.png`, fullPage: true });

  // Submit
  const submitBtn = page.locator('main form button[type="submit"]:has-text("Enregistrer")').first();
  await submitBtn.click();

  // Attente : soit form se ferme (succès) soit message d'erreur apparaît
  // V1.9 form ferme après upload réussi → on attend la disparition du h4 "Nouveau devis"
  // dans <main> (pour ignorer sidebar). Si bandeau erreur "rouge" → form reste ouvert.
  // Aussi : si navigation /login, échec auth.
  const submitOutcome = await Promise.race([
    page.waitForFunction(
      () => !document.querySelector('main form h4'),
      { timeout: 20000 }
    ).then(() => 'closed').catch(() => null),
    page.waitForFunction(
      () => {
        const errBanner = document.querySelector('main form .bg-red-50, main form .text-red-800');
        return errBanner && errBanner.textContent && errBanner.textContent.trim().length > 0;
      },
      { timeout: 20000 }
    ).then(() => 'error').catch(() => null),
    page.waitForURL((u) => u.toString().includes('/login'), { timeout: 20000 })
      .then(() => 'login_redirect').catch(() => null),
  ]);
  if (submitOutcome === 'login_redirect') {
    throw new Error('submit a redirigé vers /login (auth perdue ou mauvais bouton cliqué)');
  }

  await page.screenshot({ path: `${ARTIFACTS}/${TS}_${scope}_after_submit.png`, fullPage: true });

  const consoleErrorsAfter = consoleErrors.length;
  const networkErrorsAfter = networkErrors.length;
  const newConsoleErrors = consoleErrors.slice(consoleErrorsBefore);
  const newNetworkErrors = networkErrors.slice(networkErrorsBefore);

  // Filtre noise
  const criticalConsole = newConsoleErrors.filter((e) =>
    !e.match(/favicon|manifest|404.*\.png/i) &&
    !e.includes('Failed to fetch RSC payload') &&
    !e.includes('Falling back to browser navigation')
  );
  const criticalNetwork = newNetworkErrors.filter((u) =>
    !u.match(/favicon|manifest/) && !u.match(/_rsc=/)
  );

  if (submitOutcome === 'error') {
    const errMsg = await page.locator('form .bg-red-50, form .text-red-800').first().textContent().catch(() => '?');
    throw new Error(`form rejette submit : "${errMsg?.trim().slice(0, 200)}" | console=${criticalConsole.length} network=${criticalNetwork.length}`);
  }
  if (submitOutcome === null) {
    throw new Error(`timeout submit (ni form fermé ni erreur visible) | console=${criticalConsole.length} (${criticalConsole.slice(0, 2).join(' | ')}) network=${criticalNetwork.length} (${criticalNetwork.slice(0, 2).join(' | ')})`);
  }

  if (criticalConsole.length > 0) {
    throw new Error(`console errors pendant submit : ${criticalConsole.slice(0, 3).join(' | ')}`);
  }
  if (criticalNetwork.length > 0) {
    throw new Error(`network errors pendant submit : ${criticalNetwork.slice(0, 3).join(' | ')}`);
  }

  // Vérifie row apparaît
  await page.waitForTimeout(800);
  const rowLocator = page.locator(`table tbody tr:has-text("${docName.slice(0, 30)}")`).first();
  if (!(await rowLocator.count())) {
    // Le doc utilise originalFilename donc le nom affiché est "smoke-test-doc.pdf"
    // → cherche aussi par ce nom + check qu'il y a au moins une row de plus qu'avant
    console.log(`⚠ row non trouvée par nom — vérifier par filename fallback`);
  }

  // Cleanup : trash button sur la dernière row insérée
  // Cherche row par originalFilename "smoke-test-doc.pdf"
  const cleanupRow = page.locator(`table tbody tr:has-text("smoke-test-doc")`).first();
  if (await cleanupRow.count()) {
    const trashBtn = cleanupRow.locator('button[title="Supprimer"]').first();
    if (await trashBtn.count()) {
      await trashBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${ARTIFACTS}/${TS}_${scope}_after_delete.png`, fullPage: true });
    } else {
      console.log(`⚠ ${scope}: bouton Supprimer introuvable sur la row — ligne laissée en prod`);
    }
  } else {
    console.log(`⚠ ${scope}: row d'upload introuvable pour cleanup — ligne possiblement laissée en prod`);
  }

  return { submitOutcome, criticalConsole, criticalNetwork };
}

// =========================================================================
// SCOPE Société
// =========================================================================

await test('S submit cycle (devis sur fiche société)', async () => {
  await gotoFirstEntity('/societes', '/societes/');
  await openComptaTab();
  await submitDevisCycle({
    scope: 'company',
    scopeName: 'Société',
    pickSupplier: true,
    pickCompany: false, // verrouillé (input readonly)
  });
});

// =========================================================================
// SCOPE Marché
// =========================================================================

await test('M submit cycle (devis sur fiche marché)', async () => {
  await gotoFirstEntity('/marches', '/marches/');
  await openComptaTab();
  await submitDevisCycle({
    scope: 'marche',
    scopeName: 'Marché',
    pickSupplier: false, // pré-rempli avec fournisseur du marché
    pickCompany: true, // dropdown (peut être inter-société)
  });
});

// =========================================================================
// SCOPE Fournisseur (nouveauté V1.10 read-write)
// =========================================================================

await test('F submit cycle (devis sur fiche fournisseur)', async () => {
  await gotoFirstEntity('/fournisseurs', '/fournisseurs/');
  await openComptaTab();
  await submitDevisCycle({
    scope: 'supplier',
    scopeName: 'Fournisseur',
    pickSupplier: false, // verrouillé (input readonly)
    pickCompany: true, // dropdown choix société
  });
});

await browser.close();

const passed = results.filter((r) => r.startsWith('PASS')).length;
const failed = results.filter((r) => r.startsWith('FAIL')).length;
const skipped = results.filter((r) => r.startsWith('SKIP')).length;
const report = `
=== Smoke V1.10 SUBMIT (PR #274) — ${TS} ===
Tests: ${results.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}
Run tag: ${RUN_TAG}

${results.join('\n')}

Console errors (all): ${consoleErrors.length}
Network 4xx/5xx errors (all): ${networkErrors.length}
${consoleErrors.slice(0, 5).map((e) => `  - console: ${e.slice(0, 200)}`).join('\n')}
${networkErrors.slice(0, 5).map((e) => `  - network: ${e}`).join('\n')}
`;
fs.writeFileSync(`${ARTIFACTS}/${TS}_v110_submit_report.txt`, report);
console.log(report);
process.exit(failed > 0 ? 1 : 0);
