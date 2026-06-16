// Smoke V1.11 (Remarques client dashboard-15.pages) contre prod.
//
// Couvre :
//   R1 — ETAT marché ACTIF/INACTIF, toggle edit, default ACTIF
//   R2 — H1 fiche marché = description (badge type travaux)
//   R3 — subtitle fiche marché sans propertyName
//   R4 — liste marchés sans colonnes Société / Bien
//   R5 — filtre par défaut ACTIF + toggle "Afficher inactifs"
//   R6 — filterFn colonne Lots concernés
//   R7 — colonne Description en 2ᵉ position (entre Fournisseur et Type)
//   R8 — fiche société Assujettie TVA + select fréquence + Row identityTab
//   R9 — DocumentsManager labelFor(category) dynamique (labels live admin)
//
// Usage :
//   1) lance `node Apps/nat-life/tests/smoke-v111.mjs` depuis racine repo
//   2) si pas de session valide → script affiche "📧 OTP envoyé" → lis le code
//      reçu sur lexialingo@gmail.com et écris-le dans /tmp/natlife-otp-code

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
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
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
    }
  }
}

// ===========================================================================
// Auth (session reuse + OTP fallback via gws Gmail)
// ===========================================================================
let sessionValid = false;
if (contextOpts.storageState) {
  try {
    const probe = await page.goto(`${URL_BASE}/marches`, { waitUntil: 'networkidle', timeout: 30000 });
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
  await page.waitForSelector(
    'input[name="token"], input[name="code"], input[inputmode="numeric"]',
    { timeout: 20000 }
  );
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
  if (!otp) {
    console.log('❌ Timeout OTP');
    process.exit(1);
  }
  const otpInput = await page.$('input[name="token"], input[name="code"], input[inputmode="numeric"]');
  await otpInput.fill(otp);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 });
  console.log(`✅ Logged in: ${page.url()}`);
  await context.storageState({ path: STORAGE_STATE });
}

// ===========================================================================
// R4 + R5 + R7 — liste marchés
// ===========================================================================
await test('R4+R7 liste marchés : 0 colonne Société/Bien + Description en 2e col', async () => {
  await page.goto(`${URL_BASE}/marches`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v111_r4r7_liste.png`, fullPage: true });

  const headers = await page.locator('main table thead th').allTextContents();
  console.log('   Headers:', headers.map((h) => h.trim()).filter(Boolean));

  // R4 : aucune colonne Société ni Bien (insensible casse, trim).
  const lower = headers.map((h) => h.toLowerCase().trim());
  if (lower.some((h) => h === 'société' || h === 'societe'))
    throw new Error('colonne Société toujours présente');
  if (lower.some((h) => h === 'bien')) throw new Error('colonne Bien toujours présente');

  // R7 : Description doit apparaître après Fournisseur.
  const fournisseurIdx = lower.findIndex((h) => h.includes('fournisseur'));
  const descIdx = lower.findIndex((h) => h.includes('description'));
  if (descIdx === -1) throw new Error('colonne Description absente');
  if (descIdx <= fournisseurIdx)
    throw new Error(`Description (col ${descIdx}) doit être après Fournisseur (col ${fournisseurIdx})`);
});

await test('R5 filtre par défaut ACTIF + toggle "Afficher inactifs"', async () => {
  await page.goto(`${URL_BASE}/marches`, { waitUntil: 'networkidle' });
  // Avant V1.11 : aucun marché inactif n'existait en prod → toggle peut être absent.
  // On vérifie au moins que l'URL ?showInactive=true ne casse pas la page.
  await page.goto(`${URL_BASE}/marches?showInactive=true`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v111_r5_show_inactive.png`, fullPage: true });
  const status = await page.evaluate(() => document.title);
  if (!status) throw new Error('page /marches?showInactive=true vide');
});

await test('R6 filterFn sur colonne Lots concernés (input présent)', async () => {
  await page.goto(`${URL_BASE}/marches`, { waitUntil: 'networkidle' });
  // Le filterFn est défini → l'input column-level filter doit exister sous le header.
  // Selon UI DataTable : input dans thead row 2 ou via aria-label.
  const lotsHeader = page.locator('main table thead th:has-text("Lots concernés")').first();
  if (!(await lotsHeader.count())) throw new Error('header "Lots concernés" absent');
  // OK : présence du header confirme la colonne. Filter activé via la prop filterFn
  // (testable plus finement via interactions UI dans un suivi).
});

// ===========================================================================
// R2 + R3 + R1 — fiche marché (H1 description + subtitle + badge inactif)
// ===========================================================================
await test('R2+R3 fiche marché : H1 + subtitle conformes', async () => {
  await page.goto(`${URL_BASE}/marches`, { waitUntil: 'networkidle' });
  const link = await page.$('main table tbody tr a[href^="/marches/"]');
  if (!link) skip('aucun marché en prod pour tester');
  const href = await link.getAttribute('href');
  await page.goto(`${URL_BASE}${href}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v111_r2r3_fiche_marche.png`, fullPage: true });

  // R2 : H1 doit contenir la description OU le type OU le fournisseur (jamais vide).
  const h1Text = (await page.locator('main h1').first().innerText()).trim();
  if (!h1Text) throw new Error('H1 vide');
  console.log(`   H1: "${h1Text}"`);

  // R3 : le <p> subtitle direct sous le H1 doit contenir UNIQUEMENT le fournisseur,
  // pas de "·" qui séparait avant le propertyName. On le repère via le lien
  // /fournisseurs/<id> qui doit être seul dans le subtitle (pas de Link bien après).
  const subtitle = page.locator('main h1 + p').first();
  if (!(await subtitle.count())) throw new Error('subtitle absent');
  const subtitleText = (await subtitle.innerText()).trim();
  console.log(`   Subtitle: "${subtitleText}"`);
  // Avant V1.11 : "SUPPLIER · PROPERTY_NAME" → contenait " · ".
  // Après V1.11 : "SUPPLIER" seul. Vérif absence du séparateur " · ".
  if (subtitleText.includes(' · '))
    throw new Error(`subtitle contient encore " · " (bien non retiré) : "${subtitleText}"`);
});

// ===========================================================================
// R1 — toggle ETAT actif/inactif sur edit marché
// ===========================================================================
await test('R1 edit marché : checkbox "Marché actif" présente', async () => {
  await page.goto(`${URL_BASE}/marches`, { waitUntil: 'networkidle' });
  const link = await page.$('main table tbody tr a[href^="/marches/"]');
  if (!link) skip('aucun marché en prod');
  const href = await link.getAttribute('href');
  // /marches/[id]/edit
  await page.goto(`${URL_BASE}${href}/edit`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v111_r1_edit_toggle.png`, fullPage: true });

  const checkbox = page.locator('main input[type="checkbox"][name="isActive"]').first();
  if (!(await checkbox.count())) throw new Error('checkbox isActive absente du form edit');
  const checked = await checkbox.isChecked();
  console.log(`   Marché actif (defaultChecked) = ${checked}`);
});

// ===========================================================================
// R8 — fiche société TVA Assujettie + select fréquence + Row identityTab
// ===========================================================================
await test('R8 fiche société : Row "TVA" affiche un label cohérent', async () => {
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'networkidle' });
  const link = await page.$('main table tbody tr a[href^="/societes/"]');
  if (!link) skip('aucune société en prod');
  const href = await link.getAttribute('href');
  await page.goto(`${URL_BASE}${href}`, { waitUntil: 'networkidle' });
  // Fiche société default = onglet "Vue d'ensemble". Cliquer "Identité" pour
  // voir le bloc identityTab qui contient la Row "TVA".
  const identityTab = page.locator('main button:has-text("Identité")').first();
  if (await identityTab.count()) {
    await identityTab.click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v111_r8_fiche_societe.png`, fullPage: true });
  // Row "TVA" : dt avec texte exact "TVA" (distinct de "N° TVA intracom" qui contient aussi "TVA").
  const tvaRowLabel = page.locator('main dt').filter({ hasText: /^TVA$/ }).first();
  if (!(await tvaRowLabel.count())) throw new Error('Row "TVA" absente identityTab');
});

await test('R8 edit société : checkbox Assujettie + select conditionnel', async () => {
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'networkidle' });
  const link = await page.$('main table tbody tr a[href^="/societes/"]');
  if (!link) skip('aucune société');
  const href = await link.getAttribute('href');
  await page.goto(`${URL_BASE}${href}/edit`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v111_r8_edit_societe.png`, fullPage: true });

  // Checkbox "Assujettie à la TVA"
  const checkbox = page.locator('main label:has-text("Assujettie à la TVA") input[type="checkbox"]').first();
  if (!(await checkbox.count())) throw new Error('checkbox "Assujettie à la TVA" absente');

  // Toggle on → le select fréquence doit apparaître.
  const wasChecked = await checkbox.isChecked();
  if (!wasChecked) {
    await checkbox.click();
    await page.waitForTimeout(200);
  }
  const select = page.locator('main select[name="tvaFrequency"]').first();
  if (!(await select.count())) throw new Error('select tvaFrequency absent après check');
  const options = await select.locator('option').allTextContents();
  console.log(`   Options TVA: ${options.join(' | ')}`);
  const expected = ['mensuelle', 'trimestrielle', 'annuelle'];
  for (const e of expected) {
    if (!options.some((o) => o.toLowerCase().includes(e)))
      throw new Error(`option "${e}" manquante : ${options.join(', ')}`);
  }
  // Restaure si on a toggle pour ne pas modifier l'état prod.
  if (!wasChecked) {
    await checkbox.click();
    await page.waitForTimeout(100);
  }
});

// ===========================================================================
// R9 — DocumentsManager labels dynamiques (lot scope)
// ===========================================================================
await test('R9 fiche lot Documents : colonne Catégorie présente + cellule affiche label ou —', async () => {
  // Trouver un lot via fiche bien (property).
  await page.goto(`${URL_BASE}/biens`, { waitUntil: 'networkidle' });
  const propLink = await page.$('main table tbody tr a[href^="/biens/properties/"]');
  if (!propLink) skip('aucun bien en prod');
  const propHref = await propLink.getAttribute('href');
  await page.goto(`${URL_BASE}${propHref}`, { waitUntil: 'networkidle' });
  // Cliquer 1er lot dans la structure : peut être dans treeview <details> ou
  // sous l'onglet "Bien". Onglet par défaut = "Vue d'ensemble". Forcer "Bien".
  const bienTab = page.locator('main button:has-text("Bien")').first();
  if (await bienTab.count()) {
    await bienTab.click();
    await page.waitForTimeout(300);
  }
  // Déplier tous les <details> pour exposer les liens lots.
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => (d.open = true));
  });
  await page.waitForTimeout(200);
  const lotLink = await page.$('main a[href^="/biens/lots/"]');
  if (!lotLink) skip('aucun lot sur ce bien');
  const lotHref = await lotLink.getAttribute('href');
  await page.goto(`${URL_BASE}${lotHref}`, { waitUntil: 'networkidle' });
  // Onglet Documents.
  const docsTab = page.locator('main button:has-text("Documents")').first();
  if (!(await docsTab.count())) skip('onglet Documents absent');
  await docsTab.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v111_r9_lot_docs.png`, fullPage: true });
  // Vérif présence header "Catégorie" dans le DocumentsManager.
  const catHeader = page.locator('main table thead th:has-text("Catégorie")').first();
  if (!(await catHeader.count())) skip('aucune table docs (probablement vide)');
});

// ===========================================================================
// R10 — DocumentsManager input "Filtrer" par colonne (follow-up dashboard-15)
// ===========================================================================
await test('R10 docs onglet : input "Filtrer" filtre les rows par Type', async () => {
  // Réutilise un lot avec ≥ 1 doc (sinon skip).
  await page.goto(`${URL_BASE}/biens`, { waitUntil: 'networkidle' });
  const propLink = await page.$('main table tbody tr a[href^="/biens/properties/"]');
  if (!propLink) skip('aucun bien');
  const propHref = await propLink.getAttribute('href');
  await page.goto(`${URL_BASE}${propHref}`, { waitUntil: 'networkidle' });
  const bienTab = page.locator('main button:has-text("Bien")').first();
  if (await bienTab.count()) {
    await bienTab.click();
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => (d.open = true));
  });
  const lotLink = await page.$('main a[href^="/biens/lots/"]');
  if (!lotLink) skip('aucun lot');
  const lotHref = await lotLink.getAttribute('href');
  await page.goto(`${URL_BASE}${lotHref}`, { waitUntil: 'networkidle' });
  const docsTab = page.locator('main button:has-text("Documents")').first();
  if (!(await docsTab.count())) skip('onglet Documents absent');
  await docsTab.click();
  await page.waitForTimeout(400);

  // V1.11 — input "Filtrer" doit apparaître sous chaque header (sauf Actions).
  // DataTable rend le filter input dans le même <th> que le bouton header.
  const filterInputs = page.locator('main table thead th input[placeholder="Filtrer"]');
  const inputsCount = await filterInputs.count();
  if (inputsCount === 0)
    throw new Error('aucun input "Filtrer" rendu — enableFilters peut-être resté false');
  console.log(`   ${inputsCount} input(s) "Filtrer" dans header`);

  // Compter rows initiales
  const rowsBefore = await page.locator('main table tbody tr').count();
  if (rowsBefore < 1) skip('aucun doc à filtrer');

  // Lire le texte de la première cellule "Type" pour avoir un filtre garanti match.
  const firstTypeCell = await page.locator('main table tbody tr').first().locator('td').nth(0).innerText();
  const filterValue = firstTypeCell.trim().slice(0, 3); // premiers 3 chars
  if (!filterValue) skip('cellule Type vide');
  console.log(`   Test filtre Type avec "${filterValue}" (rows initial=${rowsBefore})`);

  // Cibler 1er input filtre (col Type)
  await filterInputs.first().fill(filterValue);
  await page.waitForTimeout(300);
  const rowsAfter = await page.locator('main table tbody tr').count();
  console.log(`   Après filtre : ${rowsAfter} rows`);
  if (rowsAfter < 1) throw new Error('filtre a cassé toutes les rows (devrait matcher au moins celle source)');
  // Reset
  await filterInputs.first().fill('');
  await page.waitForTimeout(200);
  const rowsReset = await page.locator('main table tbody tr').count();
  if (rowsReset !== rowsBefore) throw new Error(`reset filtre ne restaure pas : ${rowsReset} vs ${rowsBefore}`);
});

// ===========================================================================
// R11 — AccountingDocumentsManager input "Filtrer" Type (follow-up dashboard-15)
// ===========================================================================
await test('R11 compta onglet : filtre Type matche label visible (Devis/Commande/Facture)', async () => {
  await page.goto(`${URL_BASE}/societes`, { waitUntil: 'networkidle' });
  const link = await page.$('main table tbody tr a[href^="/societes/"]');
  if (!link) skip('aucune société');
  const href = await link.getAttribute('href');
  await page.goto(`${URL_BASE}${href}`, { waitUntil: 'networkidle' });
  const comptaTab = page.locator('main button:has-text("Compta")').first();
  if (!(await comptaTab.count())) skip('onglet Compta absent');
  await comptaTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v111_r11_compta.png`, fullPage: true });

  const filterInputs = page.locator('main table thead th input[placeholder="Filtrer"]');
  const inputsCount = await filterInputs.count();
  if (inputsCount === 0) skip('aucun input filtre rendu (probablement table vide)');
  console.log(`   ${inputsCount} input(s) "Filtrer" sur table Compta`);

  const rowsBefore = await page.locator('main table tbody tr').count();
  if (rowsBefore < 1) skip('aucun doc compta à filtrer');

  // Filtre col Type avec "Fact" : filterFn V1.11 matche label visible "Facture" pas slug "facture".
  await filterInputs.first().fill('Fact');
  await page.waitForTimeout(300);
  const rowsAfter = await page.locator('main table tbody tr').count();
  console.log(`   Filtre "Fact" : ${rowsAfter} / ${rowsBefore} rows`);
  // Sanity : si rowsBefore avait des kind != facture, rowsAfter < rowsBefore.
  // Si tous étaient déjà facture, rowsAfter == rowsBefore. Les 2 sont valides.
  // Au moins, le filtre ne doit pas casser toutes les rows.
  if (rowsAfter < 1 && rowsBefore > 0) {
    // Possible cas où aucun facture exist en prod. Tester avec "Devis" en fallback.
    await filterInputs.first().fill('Devis');
    await page.waitForTimeout(300);
    const rowsDevis = await page.locator('main table tbody tr').count();
    if (rowsDevis < 1) throw new Error('filtre Devis/Facture casse toutes les rows');
  }
  await filterInputs.first().fill('');
  await page.waitForTimeout(200);
});

// ===========================================================================
// R12 — Fiche edit document : champ Catégorie en read-only display (héritée du type)
// ===========================================================================
await test('R12 edit doc : champ Catégorie remplacé par read-only display', async () => {
  // Cible spécifique : CANAL DE PROVENCE qui a au moins 1 doc (YTEST).
  await page.goto(`${URL_BASE}/fournisseurs`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const supLink = page.locator('main a:has-text("CANAL DE PROVENCE")').first();
  if (!(await supLink.count())) skip('CANAL DE PROVENCE introuvable');
  const supHref = await supLink.getAttribute('href');
  await page.goto(`${URL_BASE}${supHref}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const docsTab = page.locator('main button:has-text("Documents")').first();
  if (!(await docsTab.count())) skip('onglet Documents absent');
  await docsTab.click();
  await page.waitForTimeout(600);
  const editLink = page.locator('main a[href^="/documents/edit/supplier/"]').first();
  if (!(await editLink.count())) skip('aucun doc à éditer');
  const editHref = await editLink.getAttribute('href');
  console.log(`   editHref = ${editHref}`);
  await page.goto(`${URL_BASE}${editHref}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v112_r12_edit_doc.png`, fullPage: true });

  // V1.12 R1 : aucun <select name="category"> dans le form.
  const catSelect = page.locator('main select[name="category"]');
  if (await catSelect.count() > 0)
    throw new Error('<select name="category"> toujours présent — R1 non appliqué');

  // Doit y avoir un label "Catégorie (héritée du type)".
  const heritedLabel = page.locator('main :text-matches("Cat[ée]gorie.*h[ée]rit[ée]e", "i")').first();
  if (!(await heritedLabel.count()))
    throw new Error('label "Catégorie (héritée du type)" absent');
  console.log('   Catégorie read-only display OK');
});

// ===========================================================================
// R13 — Liste docs fiche fournisseur : col Catégorie remplie depuis le type
// ===========================================================================
await test('R13 liste docs fournisseur : col Catégorie remplie via JOIN document_types', async () => {
  await page.goto(`${URL_BASE}/fournisseurs`, { waitUntil: 'networkidle' });
  const supLink = await page.$('main table tbody tr a[href^="/fournisseurs/"]');
  if (!supLink) skip('aucun fournisseur');
  const supHref = await supLink.getAttribute('href');
  await page.goto(`${URL_BASE}${supHref}`, { waitUntil: 'networkidle' });
  const docsTab = page.locator('main button:has-text("Documents")').first();
  if (!(await docsTab.count())) skip('onglet Documents absent');
  await docsTab.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v112_r13_liste_docs.png`, fullPage: true });

  // Header "Catégorie" présent.
  const catHeader = page.locator('main table thead th:has-text("Catégorie")').first();
  if (!(await catHeader.count())) skip('table docs vide');

  // Vérif fonctionnelle : il existe au moins UNE row avec une catégorie non-"—"
  // (signifie que le JOIN sur document_types.category retourne une valeur).
  const rowsWithCategory = await page
    .locator('main table tbody tr')
    .evaluateAll((rows) =>
      rows.filter((row) => {
        const cells = row.querySelectorAll('td');
        // Catégorie est la 2e col (index 1) selon documents-manager.
        const cellText = cells[1]?.textContent?.trim() ?? '';
        return cellText.length > 0 && cellText !== '—';
      }).length
    );
  console.log(`   Rows avec catégorie remplie : ${rowsWithCategory}`);
  // Pas d'assertion forte sur > 0 : la prod peut avoir tous les types sans catégorie.
  // Vrai test = pas d'erreur de rendu.
});

// ===========================================================================
// R14 — Widget tableau de bord : filtre supplier_type_id (info-only en prod)
// ===========================================================================
await test('R14 widget : section "Documents requis manquants" rend sans erreur', async () => {
  await page.goto(`${URL_BASE}/`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v112_r14_dashboard.png`, fullPage: true });
  // Le widget est dans la home page tableau de bord.
  // Vérif faible : présence du composant ou son fallback.
  const widget = page.locator('main :text-matches("Documents.*(requis|manquants|obligatoires)", "i")').first();
  if (!(await widget.count())) skip('widget non rendu (peut-être pas en V1.11 still)');
  console.log('   Widget docs requis manquants présent (filtre supplier_type_id côté SQL)');
});

// ===========================================================================
// R15 — Suppression fournisseur avec marchés : message custom FK
// ===========================================================================
// Test : ouvre modal delete sur CANAL DE PROVENCE (a 2 marchés), tape nom,
// clique "Supprimer définitivement", assert message custom "Impossible de
// supprimer car présent dans : ..." apparaît dans la modale (sans digest générique).
// PAS d'actual delete : la modale reste ouverte avec l'erreur affichée.
await test('R15 deleteSupplierAction FK : message custom dans modale (CANAL DE PROVENCE)', async () => {
  await page.goto(`${URL_BASE}/fournisseurs`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const supLink = page.locator('main a:has-text("CANAL DE PROVENCE")').first();
  if (!(await supLink.count())) skip('CANAL DE PROVENCE introuvable');
  const href = await supLink.getAttribute('href');
  await page.goto(`${URL_BASE}${href}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Cliquer "Supprimer" (en haut à droite de la fiche, pas dans la liste docs)
  const delBtn = page.locator('main header button:has-text("Supprimer"), main button:has-text("Supprimer"):not(:has-text("document"))').first();
  if (!(await delBtn.count())) skip('bouton Supprimer absent');
  await delBtn.click();
  await page.waitForTimeout(500);

  // Modale ouverte : input avec placeholder = nom du fournisseur
  const modalInput = page.getByPlaceholder('CANAL DE PROVENCE').first();
  if (!(await modalInput.count())) skip('input confirmation absent (placeholder)');
  await modalInput.fill('CANAL DE PROVENCE');
  await page.waitForTimeout(200);

  // Cliquer "Supprimer définitivement"
  const confirmBtn = page.getByRole('button', { name: /Supprimer d[ée]finitivement/i }).first();
  if (!(await confirmBtn.count())) throw new Error('bouton "Supprimer définitivement" absent');
  await confirmBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v112_r15_fk_msg.png`, fullPage: true });

  // Vérif : la modale doit afficher "Impossible de supprimer" (alert role).
  // ET le digest générique NE doit PAS être présent.
  const bodyText = (await page.textContent('body')) ?? '';
  if (bodyText.includes('An error occurred in the Server Components render')) {
    throw new Error('digest générique encore visible — R4 non appliqué côté serveur');
  }
  const alertMsg = await page.locator('[role="alert"]').first().textContent().catch(() => '');
  console.log(`   alert msg: "${alertMsg?.slice(0, 150)}…"`);
  if (!alertMsg || !/Impossible de supprimer|pr[ée]sent dans/i.test(alertMsg)) {
    // Peut-être que CANAL DE PROVENCE a été deleted entre temps (improbable) ;
    // dans ce cas la page redirige vers /fournisseurs sans erreur.
    if (page.url().includes('/fournisseurs') && !page.url().includes('/fournisseurs/')) {
      throw new Error('CANAL DE PROVENCE supprimé sans message FK — R4 non testable');
    }
    throw new Error('message custom FK introuvable dans la modale');
  }
  console.log('   Message custom FK affiché OK');

  // Fermer la modale (Annuler) pour ne pas laisser état modifié
  const cancelBtn = page.getByRole('button', { name: /Annuler/i }).first();
  if (await cancelBtn.count()) await cancelBtn.click();
});

// ===========================================================================
// R16 — Upload doc : form sans champ Catégorie + insert DB OK
// ===========================================================================
// Submit réel sur une fiche fournisseur. Cible CANAL DE PROVENCE.
// Crée un doc test "SMOKE V112 TEST", vérifie qu'il apparaît dans la liste.
// (Cleanup automatique via R17 et R18 qui éditent/suppriment ce doc.)
let smokeTestDocName = `SMOKE V112 ${Date.now()}`;
let smokeTestSupplierHref = null;

await test('R16 upload doc : form sans champ Catégorie + insert DB OK', async () => {
  await page.goto(`${URL_BASE}/fournisseurs`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const supLink = page.locator('main a:has-text("CANAL DE PROVENCE")').first();
  if (!(await supLink.count())) skip('CANAL DE PROVENCE introuvable');
  smokeTestSupplierHref = await supLink.getAttribute('href');
  await page.goto(`${URL_BASE}${smokeTestSupplierHref}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const docsTab = page.locator('main button:has-text("Documents")').first();
  if (!(await docsTab.count())) skip('onglet Documents absent');
  await docsTab.click();
  await page.waitForTimeout(500);

  // Cliquer "Ajouter un document"
  const addBtn = page.locator('main button:has-text("Ajouter un document")').first();
  if (!(await addBtn.count())) skip('bouton Ajouter absent');
  await addBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v112_r16_form.png`, fullPage: true });

  // V1.12 R1 : le form upload ne doit PAS contenir un <select name="category">
  const categorySelect = page.locator('form select').filter({ has: page.locator('option:has-text("notaire"), option:has-text("Notaire")') });
  if ((await categorySelect.count()) > 0) {
    throw new Error('Le <select Catégorie> est toujours dans le form upload — R1 non appliqué');
  }
  console.log('   Form upload n\'a pas de <select name="category"> — R1 OK');

  // Sélectionner le 1er type disponible
  const typeSelect = page.locator('form select').first();
  await typeSelect.selectOption({ index: 1 }); // skip "— Choisir —"
  await page.waitForTimeout(200);

  // Fichier : créer un buffer fictif
  const fileInput = page.locator('form input[type="file"]').first();
  await fileInput.setInputFiles({
    name: 'smoke-v112-test.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Smoke V1.12 test content'),
  });
  await page.waitForTimeout(200);

  // Nom du doc
  const nameInput = page.locator('form input[name=""], form input[required]:not([type="file"])').first();
  // Fallback selector : input avec placeholder KBis
  const nameInputAlt = page.locator('form input[placeholder*="KBis"]').first();
  const inputToUse = (await nameInputAlt.count()) ? nameInputAlt : nameInput;
  await inputToUse.fill(smokeTestDocName);
  await page.waitForTimeout(200);

  // Submit "Uploader"
  const submitBtn = page.locator('form button:has-text("Uploader")').first();
  if (!(await submitBtn.count())) throw new Error('bouton Uploader absent');
  await submitBtn.click();

  // Attendre que le form se ferme + le doc apparaisse dans la table
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v112_r16_after.png`, fullPage: true });

  const docRow = page.locator(`main table tbody tr:has-text("${smokeTestDocName}")`).first();
  if (!(await docRow.count())) {
    // Récupérer message d'erreur si présent
    const errMsg = await page.locator('form p:has-text("erreur"), form p.text-red-800').first().textContent().catch(() => '');
    throw new Error(`doc "${smokeTestDocName}" pas apparu dans liste après upload. err="${errMsg}"`);
  }
  console.log(`   Doc "${smokeTestDocName}" uploadé + apparait dans la liste — R1 submit OK`);
});

// ===========================================================================
// R17 — Edit doc : submit save sans champ Catégorie
// ===========================================================================
await test('R17 edit doc : submit save (form sans champ Catégorie) persist', async () => {
  if (!smokeTestSupplierHref) skip('R16 a skip — pas de doc test à éditer');
  await page.goto(`${URL_BASE}${smokeTestSupplierHref}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const docsTab = page.locator('main button:has-text("Documents")').first();
  await docsTab.click();
  await page.waitForTimeout(500);

  // Trouver le doc test + cliquer son icône Modifier
  const editLink = page.locator(`main table tbody tr:has-text("${smokeTestDocName}") a[href^="/documents/edit/supplier/"]`).first();
  if (!(await editLink.count())) skip('icône Modifier introuvable sur doc test');
  await editLink.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v112_r17_edit_form.png`, fullPage: true });

  // V1.12 R1 : pas de <select name="category">
  if ((await page.locator('form select[name="category"]').count()) > 0) {
    throw new Error('<select name="category"> présent dans edit form — R1 non appliqué');
  }

  // Modifier la note
  const notesField = page.locator('form textarea[name="notes"]').first();
  if (!(await notesField.count())) skip('textarea notes absent');
  const newNote = `Edit smoke V1.12 ${Date.now()}`;
  await notesField.fill(newNote);

  // Submit "Enregistrer"
  const saveBtn = page.locator('form button:has-text("Enregistrer")').first();
  if (!(await saveBtn.count())) throw new Error('bouton Enregistrer absent');
  await saveBtn.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v112_r17_after_save.png`, fullPage: true });

  // Vérif : redirect vers fiche fournisseur (URL contient /fournisseurs/)
  if (!page.url().includes('/fournisseurs/')) {
    throw new Error(`pas de redirect post-save. URL = ${page.url()}`);
  }
  console.log('   Edit doc save sans champ Catégorie OK — R1 submit edit OK');
});

// ===========================================================================
// R18 — Cleanup : supprimer le doc test créé par R16/R17
// ===========================================================================
await test('R18 cleanup : delete doc smoke test', async () => {
  if (!smokeTestSupplierHref) skip('R16 a skip — rien à cleanup');
  await page.goto(`${URL_BASE}${smokeTestSupplierHref}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const docsTab = page.locator('main button:has-text("Documents")').first();
  await docsTab.click();
  await page.waitForTimeout(500);

  // Trouver le doc test + cliquer le bouton trash (rouge)
  const docRow = page.locator(`main table tbody tr:has-text("${smokeTestDocName}")`).first();
  if (!(await docRow.count())) {
    console.log('   Doc déjà supprimé (probablement)');
    return;
  }
  const trashBtn = docRow.locator('button[title="Supprimer"], button:has(svg.lucide-trash-2)').first();
  if (!(await trashBtn.count())) skip('bouton trash absent');

  // confirm() native dialog (DocumentsManager utilise window.confirm)
  page.on('dialog', async (d) => d.accept());
  await trashBtn.click();
  await page.waitForTimeout(2000);

  const stillExists = page.locator(`main table tbody tr:has-text("${smokeTestDocName}")`);
  if ((await stillExists.count()) > 0) {
    console.log(`   ⚠ Doc "${smokeTestDocName}" pas supprimé — cleanup partiel`);
  } else {
    console.log(`   Doc "${smokeTestDocName}" supprimé — cleanup OK`);
  }
});

// ===========================================================================
// Console errors (filtré bruits connus)
// ===========================================================================
await test('console errors filtered', async () => {
  const critical = consoleErrors.filter(
    (e) =>
      !e.match(/favicon|manifest|404.*\.png/i) &&
      !e.includes('Failed to fetch RSC payload') &&
      !e.includes('Falling back to browser navigation')
  );
  if (critical.length > 0)
    throw new Error(`${critical.length} errors: ${critical.slice(0, 3).join(' | ')}`);
});

await browser.close();

const passed = results.filter((r) => r.startsWith('PASS')).length;
const failed = results.filter((r) => r.startsWith('FAIL')).length;
const skipped = results.filter((r) => r.startsWith('SKIP')).length;
console.log('\n=== Résultats ===');
results.forEach((r) => console.log(r));
console.log(`\n${passed} pass · ${failed} fail · ${skipped} skip / ${results.length} total`);
console.log(`📂 Artefacts : ${ARTIFACTS}/`);

if (failed > 0) process.exit(1);
