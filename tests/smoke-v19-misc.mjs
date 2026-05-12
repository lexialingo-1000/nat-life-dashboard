// Smoke V1.9 misc fixes (PR #229) contre prod.

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
const STORAGE_STATE = process.env.STORAGE_STATE || path.join(ARTIFACTS, 'storage-state.json');

const browser = await chromium.launch({ headless: true });
const ctxOpts = { viewport: { width: 1920, height: 1080 }, userAgent: 'Mozilla/5.0' };
if (fs.existsSync(STORAGE_STATE)) ctxOpts.storageState = STORAGE_STATE;
const context = await browser.newContext(ctxOpts);
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const results = [];
class SkipError extends Error {}
function skip(msg) { throw Object.assign(new SkipError(msg), { skip: true }); }
async function test(name, fn) {
  try { await fn(); results.push(`PASS ${name}`); console.log(`✅ ${name}`); }
  catch (e) {
    if (e instanceof SkipError) { results.push(`SKIP ${name}: ${e.message}`); console.log(`⏭  ${name}: ${e.message}`); }
    else { results.push(`FAIL ${name}: ${e.message}`); console.log(`❌ ${name}: ${e.message}`); }
  }
}

// Session check
const probe = await page.goto(`${URL_BASE}/societes`, { waitUntil: 'networkidle', timeout: 20000 });
if (!probe || page.url().includes('/login')) {
  console.log('❌ Session invalide. Run smoke-v19-pr3.mjs avec OTP avant.');
  process.exit(1);
}
console.log(`✅ Session OK`);

// =========================================================================
// 1. Typo Devis (PR #229 fix #1)
// =========================================================================

await test('1a Compta : header "Devis" (pas "Deviss")', async () => {
  const link = await page.$('main table tbody tr a[href^="/societes/"]');
  if (!link) skip("aucune société");
  await page.goto(`${URL_BASE}${await link.getAttribute('href')}`, { waitUntil: 'networkidle' });
  const tab = page.locator('main button:has-text("Compta")').first();
  if (!(await tab.count())) skip("Compta tab absent");
  await tab.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v19misc_1a_compta.png`, fullPage: true });
  // Cherche "Deviss" (typo) → doit être absent
  const deviss = await page.locator('main h3:has-text("Deviss")').count();
  if (deviss > 0) throw new Error('header "Deviss" toujours présent (typo non fixé)');
  // Cherche "Devis (" (correct)
  const devisOk = await page.locator('main h3:has-text("Devis (")').first();
  if (!(await devisOk.count())) throw new Error('header "Devis (...)" absent');
});

await test('1b Boutons "Nouveau devis" / "Nouvelle commande" / "Nouvelle facture"', async () => {
  const nDevis = await page.locator('main button:has-text("Nouveau devis")').count();
  const nCmd = await page.locator('main button:has-text("Nouvelle commande")').count();
  const nFct = await page.locator('main button:has-text("Nouvelle facture")').count();
  if (nDevis === 0) throw new Error('bouton "Nouveau devis" absent');
  if (nCmd === 0) throw new Error('bouton "Nouvelle commande" absent (accord)');
  if (nFct === 0) throw new Error('bouton "Nouvelle facture" absent (accord)');
});

// =========================================================================
// 2. Marché dropdown filtré par fournisseur (PR #229 fix #2)
// =========================================================================

await test('2a Dropdown Marché peuplé après sélection fournisseur avec marchés', async () => {
  const newBtn = page.locator('main button:has-text("Nouveau devis")').first();
  await newBtn.click();
  await page.waitForTimeout(300);
  // Get supplier select + list options
  const supplierSelect = page.locator('main select[required]').first();
  const supplierValues = await supplierSelect.locator('option').evaluateAll((opts) =>
    opts.map((o) => ({ value: o.value, label: o.textContent }))
  );
  // Find a supplier known to have marchés. From DB : MARC BAILLY MENUISIERIE, MENUISERIES ELVA
  const target = supplierValues.find((s) =>
    s.label?.toUpperCase().includes('MARC BAILLY') ||
    s.label?.toUpperCase().includes('MENUISERIES ELVA') ||
    s.label?.toUpperCase().includes('SUDALU') ||
    s.label?.toUpperCase().includes('CANAL DE PROVENCE')
  );
  if (!target) skip("aucun supplier avec marchés trouvé dans dropdown");
  await supplierSelect.selectOption(target.value);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v19misc_2a_marche_dropdown.png`, fullPage: true });

  // 2nd select = marché. Cherche option ≠ "— Aucun —"
  const marcheSelects = await page.$$('main select:not([required])');
  if (marcheSelects.length === 0) throw new Error('select marché absent');
  const marcheSelect = marcheSelects[0];
  const isDisabled = await marcheSelect.evaluate((el) => el.disabled);
  if (isDisabled) throw new Error('select marché disabled (fournisseur a pas de marché OU bug filter)');
  const opts = await marcheSelect.evaluate((el) => Array.from(el.querySelectorAll('option')).map((o) => o.textContent));
  // Si > 1 option (Aucun + N marchés) → OK
  if (opts.length <= 1) throw new Error(`select marché vide après pick supplier ${target.label}. Options: ${JSON.stringify(opts)}`);
});

// =========================================================================
// 3. Delete inline sur 5 tables (PR #229 fix #3)
// =========================================================================

const TABLES = [
  { url: '/societes', name: 'Société', deleteTitle: 'Supprimer cette société' },
  { url: '/fournisseurs', name: 'Fournisseurs', deleteTitle: 'Supprimer ce fournisseur' },
  { url: '/clients', name: 'Clients', deleteTitle: 'Supprimer ce client' },
  { url: '/biens', name: 'Biens', deleteTitle: 'Supprimer ce lot' },
  { url: '/locations', name: 'Locations', deleteTitle: 'Supprimer cette location' },
];

for (const t of TABLES) {
  await test(`3 ${t.name} : corbeille inline présente sur ligne`, async () => {
    await page.goto(`${URL_BASE}${t.url}`, { waitUntil: 'networkidle' });
    const trash = await page.locator(`main table tbody button[title*="${t.deleteTitle}"], main table tbody button[aria-label*="${t.deleteTitle}"]`).count();
    if (trash === 0) {
      // Take screenshot pour diag
      await page.screenshot({ path: `${ARTIFACTS}/${TS}_v19misc_3_${t.name.toLowerCase()}.png`, fullPage: true });
      throw new Error(`bouton "${t.deleteTitle}" absent sur ${t.url}`);
    }
  });
}

await test('Console errors filtered', async () => {
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
=== Smoke V1.9 misc (PR #229) — ${TS} ===
Tests: ${results.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}

${results.join('\n')}

Console errors: ${consoleErrors.length}
`;
fs.writeFileSync(`${ARTIFACTS}/${TS}_v19_misc_report.txt`, report);
console.log(report);
process.exit(failed > 0 ? 1 : 0);
