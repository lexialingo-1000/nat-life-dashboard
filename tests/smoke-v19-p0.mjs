// Smoke test V1.9 P0 — bugs critiques (PR #223)
// Vérifie :
//   B1. Dialog "+ Créer un fournisseur" rendu via createPortal (parent = <body>, pas <form>)
//   B2. DeleteButton location trim() côté typed/confirmationPhrase + confirmationPhrase = customerLabel
//
// Usage : node tests/smoke-v19-p0.mjs
// Réutilise /tmp/natlife-qa/storage-state.json si valide, sinon flow OTP via /tmp/natlife-otp-code

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
async function test(name, fn) {
  try { await fn(); results.push(`PASS ${name}`); console.log(`✅ ${name}`); }
  catch (e) { results.push(`FAIL ${name}: ${e.message}`); console.log(`❌ ${name}: ${e.message}`); }
}

// Phase 0: session reuse
let sessionValid = false;
if (contextOpts.storageState) {
  try {
    const probe = await page.goto(`${URL_BASE}/fournisseurs`, { waitUntil: 'networkidle', timeout: 20000 });
    if (probe && probe.status() === 200 && !page.url().includes('/login')) {
      sessionValid = true;
      console.log(`✅ Session OK. URL: ${page.url()}`);
    } else {
      console.log(`⚠ Session expirée → OTP flow`);
    }
  } catch (e) {
    console.log(`⚠ Probe err: ${e.message}`);
  }
}

if (!sessionValid) {
  if (fs.existsSync(OTP_FILE)) fs.unlinkSync(OTP_FILE);

  console.log('=== Phase 1: submit email ===');
  await page.goto(`${URL_BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.click('button[type="submit"]');

  await page.waitForSelector('input[name="token"], input[name="code"], input[inputmode="numeric"]', { timeout: 15000 });
  console.log(`📧 OTP envoyé. Attente ${OTP_FILE} (15 min max)`);

  const POLL_TIMEOUT_MS = (Number(process.env.OTP_TIMEOUT_MIN) || 15) * 60 * 1000;
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
  console.log(`✅ OTP: ${otp}`);

  const otpInput = await page.$('input[name="token"], input[name="code"], input[inputmode="numeric"]');
  await otpInput.fill(otp);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 });
  console.log(`✅ Logged in: ${page.url()}`);
  await context.storageState({ path: STORAGE_STATE });
}

// =========================================================================
// B1 — EntityCombobox createPortal
// =========================================================================

await test('B1a /marches/new step 1 picker présent', async () => {
  await page.goto(`${URL_BASE}/marches/new`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v19_b1a_step1.png`, fullPage: true });
  const combobox = await page.$('input[name="propertyId"]');
  if (!combobox) throw new Error('input propertyId absent step 1');
});

await test('B1b sélection bien step 1 → step 2', async () => {
  // Scope to <main> to éviter sidebar logout button (button[type=submit] Déconnexion)
  const main = page.locator('main');
  const button = main.locator('button:has-text("Rechercher un bien")').first();
  if (!(await button.count())) throw new Error('bouton picker bien introuvable');
  await button.click();
  await page.waitForTimeout(300);
  // Click first option in list (scope to <main> to avoid sidebar lists)
  const firstOption = main.locator('ul li button').first();
  if (!(await firstOption.count())) throw new Error('aucune option bien');
  await firstOption.click();
  await page.waitForTimeout(200);
  // Use Continuer button text — sidebar logout button has same type=submit
  await main.locator('button:has-text("Continuer")').click();
  await page.waitForURL((u) => u.toString().includes('propertyId='), { timeout: 10000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v19_b1b_step2.png`, fullPage: true });
});

await test('B1c supplier combobox tapable + bouton "+ Créer un fournisseur"', async () => {
  const main = page.locator('main');
  const supplierBtn = main.locator('button:has-text("Rechercher un fournisseur")').first();
  if (!(await supplierBtn.count())) throw new Error('bouton picker fournisseur introuvable');
  await supplierBtn.click();
  await page.waitForTimeout(300);
  const createButton = main.locator('button:has-text("Créer un fournisseur")').first();
  if (!(await createButton.count())) throw new Error('bouton "+ Créer un fournisseur" absent');
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v19_b1c_dropdown.png`, fullPage: true });
});

await test('B1d dialog "Créer un fournisseur" rendu via createPortal (parent = body, pas <form>)', async () => {
  const main = page.locator('main');
  const createButton = main.locator('button:has-text("Créer un fournisseur")').first();
  await createButton.click();
  await page.waitForTimeout(400);
  // Dialog visible
  const dialog = await page.locator('h3:has-text("Créer un fournisseur")').first();
  if (!(await dialog.count())) throw new Error('dialog title absent après clic');
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v19_b1d_dialog.png`, fullPage: true });

  // INVARIANT createPortal: le <form> du dialog doit être un descendant DIRECT de <body>,
  // pas imbriqué dans le <form action> du marché parent.
  const portalCheck = await page.evaluate(() => {
    // Find form containing the "Créer et sélectionner" submit button
    const submitBtn = Array.from(document.querySelectorAll('button[type="submit"]')).find((b) =>
      b.textContent.includes('Créer et sélectionner')
    );
    if (!submitBtn) return { found: false };
    const dialogForm = submitBtn.closest('form');
    if (!dialogForm) return { found: true, hasForm: false };
    // Walk up — count <form> ancestors of dialogForm (should be 0 : dialogForm IS the only form on path)
    let ancestor = dialogForm.parentElement;
    let nestedInAnotherForm = false;
    while (ancestor && ancestor !== document.body) {
      if (ancestor.tagName === 'FORM') { nestedInAnotherForm = true; break; }
      ancestor = ancestor.parentElement;
    }
    return {
      found: true,
      hasForm: true,
      nestedInAnotherForm,
      parentTag: dialogForm.parentElement?.tagName,
      bodyDirectChild: dialogForm.parentElement?.parentElement === document.body,
    };
  });
  if (!portalCheck.found) throw new Error('bouton submit "Créer et sélectionner" introuvable');
  if (!portalCheck.hasForm) throw new Error('dialog n\'est pas dans un <form>');
  if (portalCheck.nestedInAnotherForm) throw new Error('BUG: dialog form imbriqué dans un autre <form> — createPortal cassé');
  console.log(`   parentTag=${portalCheck.parentTag} bodyDirectChild=${portalCheck.bodyDirectChild}`);
});

await test('B1e fermer dialog "Annuler" → marché form intact', async () => {
  const annuler = await page.locator('div.fixed button:has-text("Annuler")').first();
  if (await annuler.count()) {
    await annuler.click();
    await page.waitForTimeout(300);
  }
  // Le form marché parent doit encore exister
  const marcheForm = await page.$('form input[name="propertyId"]');
  if (!marcheForm) throw new Error('form marché disparu après fermeture dialog');
});

// =========================================================================
// B2 — DeleteButton trim() + confirmationPhrase = customerLabel
// =========================================================================

await test('B2a /locations liste rendue', async () => {
  await page.goto(`${URL_BASE}/locations`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v19_b2a_locations.png`, fullPage: true });
  const firstLink = await page.$('a[href^="/locations/"]:not([href$="/new"])');
  if (!firstLink) throw new Error('aucune location en liste');
});

await test('B2b fiche location → bouton Supprimer présent', async () => {
  const firstLink = await page.$('a[href^="/locations/"]:not([href$="/new"])');
  const href = await firstLink.getAttribute('href');
  await page.goto(`${URL_BASE}${href}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v19_b2b_loc_detail.png`, fullPage: true });
  // Scope to <main> + exact text — sidebar peut avoir d'autres "Supprimer"
  const deleteBtn = page.locator('main button:has-text("Supprimer")').first();
  if (!(await deleteBtn.count())) throw new Error('bouton Supprimer absent');
});

await test('B2c clic Supprimer → modale + comparaison trim()', async () => {
  const deleteBtn = page.locator('main button:has-text("Supprimer")').first();
  await deleteBtn.click();
  await page.waitForTimeout(300);
  // Modale visible : récupère le span avec confirmationPhrase
  const phraseEl = await page.locator('span.font-mono.text-red-600').first();
  if (!(await phraseEl.count())) throw new Error('phrase à taper absente dans modale');
  const phrase = (await phraseEl.textContent()).trim();
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v19_b2c_modal.png`, fullPage: true });
  console.log(`   phrase attendue: "${phrase}"`);

  // Tape la phrase AVEC un espace traîlant pour valider le .trim()
  const input = await page.locator('div.fixed input.input').first();
  if (!(await input.count())) throw new Error('input modale absent');
  await input.fill(`${phrase} `);
  await page.waitForTimeout(200);

  // Le bouton "Supprimer définitivement" doit être activé (pas disabled)
  const confirmBtn = await page.locator('button:has-text("Supprimer définitivement")').first();
  if (!(await confirmBtn.count())) throw new Error('bouton confirmer absent');
  const disabled = await confirmBtn.getAttribute('disabled');
  if (disabled !== null) throw new Error(`bouton encore désactivé malgré trim — disabled="${disabled}"`);

  // Ne PAS cliquer : on ne veut pas réellement supprimer une location prod
  // Fermer via Annuler
  await page.locator('div.fixed button:has-text("Annuler")').click();
  await page.waitForTimeout(200);
});

await test('B2d fiche client onglet Locations — confirmationPhrase = customerLabel', async () => {
  // Find a customer with locations
  await page.goto(`${URL_BASE}/clients`, { waitUntil: 'networkidle' });
  // Pick any client and check their /clients/[id] locations tab
  const clientLink = await page.$('table tbody tr:first-child a[href^="/clients/"]');
  if (!clientLink) {
    results.push('SKIP B2d: aucun client en liste');
    return;
  }
  const href = await clientLink.getAttribute('href');
  await page.goto(`${URL_BASE}${href}`, { waitUntil: 'networkidle' });
  // Find Locations tab
  const locTab = await page.locator('button[role="tab"]:has-text("Locations"), button:has-text("Locations")').first();
  if (await locTab.count()) {
    await locTab.click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v19_b2d_client_locations.png`, fullPage: true });

  // Trash icon : variant=icon DeleteButton
  const trashBtn = await page.locator('button[title*="upprimer"], button[aria-label*="upprimer"]').first();
  if (!(await trashBtn.count())) {
    results.push('SKIP B2d: pas de location pour ce client');
    return;
  }
  await trashBtn.click();
  await page.waitForTimeout(300);

  // Phrase doit correspondre au customerLabel (titre/nom du client visible sur la fiche), pas au lotName
  const phraseEl = await page.locator('span.font-mono.text-red-600').first();
  if (!(await phraseEl.count())) throw new Error('phrase modal absente');
  const phrase = (await phraseEl.textContent()).trim();
  console.log(`   phrase modale: "${phrase}"`);
  // Récupère le titre client header pour comparer
  const h1 = await page.locator('h1').first();
  const h1Text = (await h1.textContent()).trim();
  console.log(`   h1 fiche client: "${h1Text}"`);
  // La phrase doit contenir une partie du customerLabel (h1) — pas le nom du lot
  // Le customerLabel partagé entre header h1 et la phrase modale.
  // Heuristique : ils doivent partager au moins un mot >3 chars.
  const phraseWords = phrase.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const h1Words = h1Text.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const overlap = phraseWords.filter((w) => h1Words.includes(w));
  if (overlap.length === 0) {
    throw new Error(`phrase "${phrase}" ne contient AUCUN mot du nom client "${h1Text}" — c'est peut-être encore le lotName`);
  }
  // Annuler
  await page.locator('div.fixed button:has-text("Annuler")').click();
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
=== Smoke V1.9 P0 (PR #223) — ${TS} ===
Tests: ${results.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}

${results.join('\n')}

Console errors: ${consoleErrors.length}
`;
fs.writeFileSync(`${ARTIFACTS}/${TS}_v19_p0_report.txt`, report);
console.log(report);
process.exit(failed > 0 ? 1 : 0);
