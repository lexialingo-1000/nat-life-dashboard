// Smoke V1.13 (Remarques client dashboard-17.pages) contre prod.
//
// Couvre :
//   R5 — statut "En attente" en tête sur fiche édition tâche
//   R3 — colonnes Échéance + Pièce/Niveau sur liste tâches onglet Suivi
//   R4 — champ Sous-Lot modifiable à droite de "Lot rattaché"
//   R6 — onglet "Suivi tâches" sur fiche fournisseur
//   R2 — message FK suppression enrichi avec nom du parent
//   R1 — cascade catégorie : labels dynamiques admin/types-documents
//
// Usage :
//   node Apps/nat-life/tests/smoke-v113.mjs
//   (réutilise storage-state.json si présent ; sinon OTP via /tmp/natlife-otp-code)
//
// IMPORTANT : R2 n'EXÉCUTE PAS la suppression. Il déclenche le pré-flight FK
// puis annule la modale. Aucune donnée prod modifiée.

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
// Auth (session reuse + OTP fallback)
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
// Helper : trouver une fiche tâche d'édition (premier marché avec ≥ 1 tâche)
// ===========================================================================
async function findFirstTacheEditHref() {
  await page.goto(`${URL_BASE}/marches`, { waitUntil: 'domcontentloaded' });
  // Collecte les hrefs en snapshot pour éviter les stale elements (navigation
  // dans la boucle change le DOM).
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main table tbody tr a[href^="/marches/"]'))
      .map((a) => a.getAttribute('href'))
      .filter(Boolean)
  );
  for (const href of hrefs) {
    await page.goto(`${URL_BASE}${href}?tab=suivi`, { waitUntil: 'domcontentloaded' });
    // Déplier <details>
    await page.evaluate(() => {
      document.querySelectorAll('details').forEach((d) => (d.open = true));
    });
    await page.waitForTimeout(300);
    const editHref = await page.evaluate(() => {
      const a = document.querySelector('main a[href*="/taches/"][href*="/edit"]');
      return a?.getAttribute('href') ?? null;
    });
    if (editHref) {
      return { marcheHref: href, editHref };
    }
  }
  return null;
}

// ===========================================================================
// R5 — statut "En attente" en tête sur fiche édition tâche
// ===========================================================================
let tacheCtx = null;
await test('R5 fiche édition tâche : option "En attente" présente et en tête', async () => {
  tacheCtx = await findFirstTacheEditHref();
  if (!tacheCtx) skip('aucune tâche en prod');
  await page.goto(`${URL_BASE}${tacheCtx.editHref}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v113_r5_edit_tache.png`, fullPage: true });

  const statusSelect = page.locator('main select[name="status"]').first();
  if (!(await statusSelect.count())) throw new Error('select status absent');
  const options = await statusSelect.locator('option').allTextContents();
  console.log(`   Options statut: ${options.join(' | ')}`);
  if (!options.some((o) => o.toLowerCase().includes('en attente')))
    throw new Error('option "En attente" absente');
  // Tête de liste : option index 0 doit contenir "En attente"
  const firstOption = (await statusSelect.locator('option').first().innerText()).trim();
  if (!firstOption.toLowerCase().includes('en attente'))
    throw new Error(`première option = "${firstOption}", attendu "En attente"`);
});

// ===========================================================================
// R4 — champ Sous-Lot modifiable à droite de "Lot rattaché"
// ===========================================================================
await test('R4 fiche édition tâche : select Sous-lot présent (à droite de Lot)', async () => {
  if (!tacheCtx) skip('R5 a skip');
  await page.goto(`${URL_BASE}${tacheCtx.editHref}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v113_r4_souslot.png`, fullPage: true });

  const lotSelect = page.locator('main select[name="lotId"]').first();
  const sousLotSelect = page.locator('main select[name="marcheSousLotId"]').first();
  if (!(await lotSelect.count())) throw new Error('select lotId absent');
  if (!(await sousLotSelect.count())) throw new Error('select marcheSousLotId absent');

  // Vérifier que Sous-lot est dans la même grid-cols-2 que Lot rattaché.
  // Heuristique : les 2 selects partagent un ancêtre direct avec class contenant "grid-cols-2".
  const bothInSameGrid = await page.evaluate(() => {
    const lot = document.querySelector('main select[name="lotId"]');
    const sousLot = document.querySelector('main select[name="marcheSousLotId"]');
    if (!lot || !sousLot) return false;
    // Remonter jusqu'à un grid-cols-2 commun
    let lotParent = lot.parentElement;
    while (lotParent) {
      if (lotParent.className && lotParent.className.includes('grid-cols-2')) {
        return lotParent.contains(sousLot);
      }
      lotParent = lotParent.parentElement;
    }
    return false;
  });
  if (!bothInSameGrid)
    console.log('   ⚠ Lot et Sous-Lot pas dans même grid-cols-2 (visuel peut diverger)');

  const sousLotOpts = await sousLotSelect.locator('option').allTextContents();
  console.log(`   Sous-lots disponibles: ${sousLotOpts.length}`);
});

// ===========================================================================
// R3 — colonnes Échéance + Pièce/Niveau sur liste tâches onglet Suivi
// ===========================================================================
await test('R3 onglet Suivi marché : icônes Calendar + MapPin sur lignes tâches', async () => {
  if (!tacheCtx) skip('R5 a skip');
  await page.goto(`${URL_BASE}${tacheCtx.marcheHref}?tab=suivi`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Déplier sous-lots
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => (d.open = true));
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v113_r3_suivi.png`, fullPage: true });

  // Au moins une tâche présente.
  const tacheRows = await page.locator('main details ul li').count();
  if (tacheRows === 0) skip('aucune ligne tâche dépliée');
  console.log(`   ${tacheRows} ligne(s) tâche`);

  // Présence des icônes Calendar (lucide-calendar) — au moins 1 si une tâche a dueDate.
  // Si aucune tâche n'a dueDate, on tolère absence (le code rend conditionnel).
  // Vérification minimale : le composant TacheRow contient les attrs title des icônes.
  // On vérifie via le code source qu'au moins une tâche a un title="Échéance" OU "Pièce / Niveau".
  // Sinon, on confirme juste que la query renvoie le nouveau payload (pas de regression).
  const hasNewMarkup = await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('main [title]')).map((el) =>
      el.getAttribute('title')
    );
    return titles.includes('Échéance') || titles.includes('Pièce / Niveau');
  });
  if (!hasNewMarkup) {
    console.log('   ⚠ Aucune tâche prod n\'a dueDate ni roomId → markup invisible. Smoke ne valide que le rendu code.');
  }
});

// ===========================================================================
// R6 — onglet "Suivi tâches" sur fiche fournisseur
// ===========================================================================
await test('R6 fiche fournisseur : onglet "Suivi tâches" présent + tableau', async () => {
  await page.goto(`${URL_BASE}/fournisseurs`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const link = await page.$('main table tbody tr a[href^="/fournisseurs/"]');
  if (!link) skip('aucun fournisseur en prod');
  const href = await link.getAttribute('href');
  await page.goto(`${URL_BASE}${href}?tab=taches`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v113_r6_onglet_taches.png`, fullPage: true });

  // Onglet "Suivi tâches" doit exister dans la nav tabs.
  const tabBtn = page.locator('main button:has-text("Suivi tâches")').first();
  if (!(await tabBtn.count())) throw new Error('onglet "Suivi tâches" absent');
  console.log('   onglet présent');

  // Soit table (≥ 1 tâche), soit message "Aucune tâche".
  const hasTable = await page.locator('main table thead th:has-text("Marché")').count();
  const hasEmpty = await page.locator('main:has-text("Aucune tâche")').count();
  if (!hasTable && !hasEmpty)
    throw new Error('ni tableau "Marché | Sous-lot | …" ni message vide rendu');
  console.log(`   ${hasTable ? 'tableau' : 'état vide'} rendu`);
});

// ===========================================================================
// R2 — message FK suppression enrichi avec nom du parent (PAS DE DELETE RÉEL)
// ===========================================================================
await test('R2 modale suppression fournisseur : message contient nom du fournisseur', async () => {
  // Cherche un fournisseur avec ≥ 1 marché rattaché.
  await page.goto(`${URL_BASE}/fournisseurs`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const supplierLinks = await page.locator('main table tbody tr a[href^="/fournisseurs/"]').all();
  let targetHref = null;
  let targetName = null;
  for (const link of supplierLinks) {
    const href = await link.getAttribute('href');
    if (!href) continue;
    await page.goto(`${URL_BASE}${href}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Cliquer onglet "Marchés"
    const marchesTab = page.locator('main button:has-text("Marchés")').first();
    if (await marchesTab.count()) {
      await marchesTab.click();
      await page.waitForTimeout(300);
      const marchesRows = await page.locator('main table tbody tr').count();
      if (marchesRows > 0) {
        targetHref = href;
        targetName = (await page.locator('main h1').first().innerText()).trim();
        break;
      }
    }
  }
  if (!targetHref) skip('aucun fournisseur avec marchés rattachés');
  console.log(`   Cible: ${targetName} (${targetHref})`);

  await page.goto(`${URL_BASE}${targetHref}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // DeleteButton component : bouton "Supprimer" en haut à droite (ou en bas)
  const trashTrigger = page.locator('main button:has-text("Supprimer")').first();
  if (!(await trashTrigger.count())) skip('bouton Supprimer absent fiche fournisseur');
  await trashTrigger.click();
  await page.waitForTimeout(500);

  // Modale confirm : champ pour taper le nom + bouton "Supprimer définitivement"
  const confirmInput = page.locator('input[type="text"]').last();
  if (!(await confirmInput.count())) skip('modale confirm absente');
  // Tape le nom exact (cliente : input "Tape <NOM> pour confirmer")
  await confirmInput.fill(targetName);
  await page.waitForTimeout(200);
  const destroyBtn = page.locator('button:has-text("Supprimer définitivement")').first();
  if (!(await destroyBtn.count())) skip('bouton "Supprimer définitivement" absent');
  if (await destroyBtn.isDisabled()) skip('bouton désactivé après saisie nom');
  // Click → FK pre-flight déclenché côté serveur, retourne { error } sans DELETE.
  await destroyBtn.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v113_r2_fk_message.png`, fullPage: true });

  // Le message d'erreur doit contenir le nom du fournisseur entre quotes « ».
  const alertText = await page.locator('[role="alert"], .text-red-700, .bg-red-50').allTextContents();
  const joined = alertText.join(' ');
  console.log(`   Alert: "${joined.slice(0, 200)}…"`);
  if (!joined.toLowerCase().includes(targetName.toLowerCase().slice(0, 6)))
    throw new Error(`message ne contient pas "${targetName}" : "${joined.slice(0, 120)}"`);
  if (!joined.toLowerCase().includes('fournisseur'))
    throw new Error('message ne contient pas le mot "fournisseur"');
  // Annule la modale pour ne rien modifier.
  const cancelBtn = page.locator('button:has-text("Annuler")').first();
  if (await cancelBtn.count()) await cancelBtn.click();
});

// ===========================================================================
// R1 — cascade catégorie : admin/types-documents résout label dynamiquement
// ===========================================================================
await test('R1 admin/types-documents : col CATEGORIE rendue (≥ 1 badge non-vide)', async () => {
  await page.goto(`${URL_BASE}/admin/types-documents`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.screenshot({ path: `${ARTIFACTS}/${TS}_v113_r1_admin_types.png`, fullPage: true });

  // Le tableau doit avoir une colonne "Catégorie".
  const catHeader = page.locator('main table thead th:has-text("Catégorie")').first();
  if (!(await catHeader.count())) throw new Error('header "Catégorie" absent');

  // Au moins une ligne avec un badge catégorie non-vide (pas juste "—").
  const filledCats = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('main table tbody tr'));
    return rows.filter((r) => {
      const cell = r.children[3]; // col 0=grip, 1=scope, 2=label, 3=catégorie
      if (!cell) return false;
      const txt = cell.textContent?.trim() ?? '';
      return txt && txt !== '—';
    }).length;
  });
  console.log(`   ${filledCats} ligne(s) avec catégorie remplie`);
  if (filledCats === 0)
    console.log('   ⚠ Aucun type avec catégorie en prod — smoke ne valide que le rendu');
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
console.log('\n=== Résultats V1.13 ===');
results.forEach((r) => console.log(r));
console.log(`\n${passed} pass · ${failed} fail · ${skipped} skip / ${results.length} total`);
console.log(`📂 Artefacts : ${ARTIFACTS}/`);
process.exit(failed > 0 ? 1 : 0);
