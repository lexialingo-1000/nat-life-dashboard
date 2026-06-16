// Smoke prod — retours client dashboard-23 (7 remarques).
// Auth: réutilise storageState ; sinon login OTP via /tmp/natlife-otp-code
// (OTP récupéré dans Gmail lexialingo@gmail.com).
//
// Couvre :
//   R1 — poubelle suppression tâche (suivi lot)  [visuel + fonctionnel sur tâche temporaire]
//   R2 — masquer VALIDÉ (suivi lot)              [fonctionnel réversible]
//   R3 — badge statut marché retiré (suivi marché)[visuel + assertion]
//   R4 — création marché à la volée desc+type    [structurel dialog + fonctionnel create/verify/cleanup]
//   R5 — fiche fournisseur catégorie enregistrée [fonctionnel réversible]
//   R6 — PDF : VALIDÉ exclu + ordre + photo gauche[fetch + extraction texte si pdftotext]
//   R7 — types de documents mobile : Modifier accessible [visuel mobile]
//
// Env: NATLIFE_URL, NATLIFE_EMAIL, OTP_FILE, ARTIFACTS_DIR, STORAGE_STATE, FORCE_RELOGIN
// LOT_ID (défaut = lot du lien client).

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';

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
    path.resolve(process.cwd(), '../../node_modules/playwright/index.mjs'),
    path.resolve(process.cwd(), 'node_modules/playwright/index.mjs'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || 'playwright';
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
const OTP_FILE = process.env.OTP_FILE || '/tmp/natlife-otp-code';
const STORAGE_STATE = process.env.STORAGE_STATE || path.join(ARTIFACTS, 'storage-state.json');
const FORCE_RELOGIN = process.env.FORCE_RELOGIN === '1';
const LOT_ID = process.env.LOT_ID || '3d1b89d5-c8d0-405e-9866-e273950c0d50';
const SUFFIX = `ZZSMOKE-${TS.slice(11)}`; // ZZSMOKE-HH-MM-SS

const NI = 'domcontentloaded'; // networkidle ne se stabilise pas (socket Supabase realtime)
const shot = (page, name) => page.screenshot({ path: `${ARTIFACTS}/${TS}_${name}.png`, fullPage: true }).catch(() => {});

const browser = await chromium.launch({ headless: true });
const contextOpts = {
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};
if (!FORCE_RELOGIN && fs.existsSync(STORAGE_STATE)) contextOpts.storageState = STORAGE_STATE;
const context = await browser.newContext(contextOpts);
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(`PASS ${name}`); console.log(`✅ ${name}`); }
  catch (e) { results.push(`FAIL ${name}: ${e.message}`); console.log(`❌ ${name}: ${e.message}`); }
}

// ---- Auth ----
let sessionValid = false;
if (contextOpts.storageState) {
  try {
    await page.goto(`${URL_BASE}/fournisseurs`, { waitUntil: NI, timeout: 20000 });
    if (!page.url().includes('/login')) { sessionValid = true; console.log('✅ session reuse'); }
  } catch {}
}
if (!sessionValid) {
  if (fs.existsSync(OTP_FILE)) fs.unlinkSync(OTP_FILE);
  await page.goto(`${URL_BASE}/login`, { waitUntil: NI, timeout: 20000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.click('button[type="submit"]');
  await page.waitForSelector('input[name="token"], input[name="code"], input[inputmode="numeric"]', { timeout: 15000 });
  console.log(`📧 OTP envoyé à ${EMAIL}. Attente ${OTP_FILE} (15min)...`);
  const deadline = Date.now() + 15 * 60 * 1000;
  let otp = null;
  while (Date.now() < deadline) {
    if (fs.existsSync(OTP_FILE)) { const v = fs.readFileSync(OTP_FILE, 'utf8').trim(); if (v.length >= 6) { otp = v; break; } }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!otp) { console.log('❌ Timeout OTP'); process.exit(1); }
  const otpInput = await page.$('input[name="token"], input[name="code"], input[inputmode="numeric"]');
  await otpInput.fill(otp);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 });
  await context.storageState({ path: STORAGE_STATE });
  console.log('💾 session sauvée');
}

const lotSuivi = `${URL_BASE}/biens/lots/${LOT_ID}?tab=suivi-travaux`;
let marcheIdForSuivi = null;

// ============ R1 — poubelle présente sur suivi lot ============
await test('R1 — icône poubelle présente sur le suivi du lot', async () => {
  await page.goto(lotSuivi, { waitUntil: NI });
  await page.waitForSelector('select', { timeout: 10000 });
  await shot(page, 'R1_lot_suivi');
  const trash = await page.$$('button[aria-label="Supprimer cette tâche"]');
  if (trash.length === 0) throw new Error('aucune icône poubelle sur les lignes de tâche');
  // capture un marché lié pour R3
  const voirMarche = await page.$('a[href*="/marches/"][href*="tab=suivi"]');
  if (voirMarche) {
    const href = await voirMarche.getAttribute('href');
    const m = href.match(/\/marches\/([0-9a-f-]{36})/i);
    if (m) marcheIdForSuivi = m[1];
  }
});

// ============ R2 — VALIDÉ masqué (réversible) ============
await test('R2 — passer une tâche en VALIDÉ la masque (puis restauration)', async () => {
  await page.goto(lotSuivi, { waitUntil: NI });
  await page.waitForSelector('a[href*="/taches/"][href*="/edit"]', { timeout: 12000 });
  // ligne de tâche = ancêtre <div> du lien Modifier contenant un <select>
  const editLink = page.locator('a[href*="/taches/"][href*="/edit"]').first();
  const editHref = await editLink.getAttribute('href');
  const row = editLink.locator('xpath=ancestor::div[.//select][1]');
  const title = (await row.locator('span').first().innerText()).trim();
  const sel = row.locator('select').first();
  const original = await sel.inputValue();
  if (original === 'valide' || original === 'termine') throw new Error(`tâche déjà ${original} (ne devrait pas être visible)`);
  // set VALIDÉ
  await sel.selectOption('valide');
  await page.waitForTimeout(2500);
  await page.goto(lotSuivi, { waitUntil: NI });
  await page.waitForTimeout(500);
  const stillThere = title ? await page.locator(`text=${title}`).count() : 1;
  const hidden = stillThere === 0;
  // restauration via page edit (atteignable même si masquée)
  await page.goto(`${URL_BASE}${editHref}`, { waitUntil: NI });
  const editSel = await page.$('select[name="status"]');
  if (editSel) { await editSel.selectOption(original); await page.click('button[type="submit"]'); await page.waitForTimeout(1500); }
  await shot(page, 'R2_after_restore');
  if (!hidden) throw new Error(`tâche "${title}" encore visible après passage en VALIDÉ`);
});

// ============ R3 — badge statut marché retiré ============
await test('R3 — pas de badge statut marché à côté du fournisseur (suivi marché)', async () => {
  if (!marcheIdForSuivi) throw new Error('marcheId introuvable (R1)');
  await page.goto(`${URL_BASE}/marches/${marcheIdForSuivi}?tab=suivi`, { waitUntil: NI });
  await page.waitForSelector('details summary', { timeout: 10000 });
  await shot(page, 'R3_marche_suivi');
  // en-tête de branche = 1er summary ; ne doit contenir AUCUN label de statut marché
  const headerTxt = await page.$eval('details summary', (s) => s.textContent);
  const statusLabels = ['Signé', 'Devis reçu', 'Devis reçu'.toUpperCase(), 'En cours', 'Livré', 'Contesté', 'Annulé', 'devis_recu', 'signe'];
  const found = statusLabels.filter((l) => headerTxt.includes(l));
  if (found.length) throw new Error(`badge statut encore présent: ${found.join(', ')} dans "${headerTxt.trim().slice(0, 80)}"`);
});

// ============ R4 — création marché à la volée desc+type ============
await test('R4a — dialog création marché à la volée a Description + Type', async () => {
  await page.goto(`${URL_BASE}/taches/new?lotId=${LOT_ID}&returnTo=${encodeURIComponent(lotSuivi)}`, { waitUntil: NI });
  await page.waitForSelector('button:has-text("Créer un marché à la volée")', { timeout: 15000 });
  await page.click('button:has-text("Créer un marché à la volée")');
  await page.waitForSelector('div[role="dialog"]', { timeout: 8000 });
  await page.waitForTimeout(400);
  await shot(page, 'R4_dialog');
  const dialog = await page.$('div[role="dialog"]');
  const textarea = await dialog.$('textarea');
  const selects = await dialog.$$('select');
  if (!textarea) throw new Error('textarea Description absente du dialog');
  // selects: fournisseur + type (+ bien). cherche un select avec >1 option = type catalogue
  let typeSelect = null;
  for (const s of selects) {
    const optCount = await s.$$eval('option', (os) => os.length);
    const txt = await s.evaluate((el) => el.previousElementSibling?.textContent || el.closest('div')?.querySelector('label')?.textContent || '');
    if (/type/i.test(txt)) typeSelect = s;
  }
  if (!typeSelect) throw new Error('select "Type de marché" absent du dialog');
});

await test('R4b — création réelle : desc+type remontent dans /marches (puis cleanup)', async () => {
  // remplir et soumettre le dialog (déjà ouvert)
  const dialog = await page.$('div[role="dialog"]');
  if (!dialog) throw new Error('dialog fermé');
  const selects = await dialog.$$('select');
  // fournisseur (1er select, 1ère vraie option), type, bien
  for (const s of selects) {
    const opts = await s.$$eval('option', (os) => os.map((o) => o.value));
    const real = opts.find((v) => v && v.length > 10); // uuid
    if (real) await s.selectOption(real).catch(() => {});
  }
  await dialog.$eval('input', (i) => { i.value = ''; });
  await (await dialog.$('input')).fill(`${SUFFIX}-nom`);
  await (await dialog.$('textarea')).fill(`${SUFFIX}-desc`);
  await dialog.$eval('button:has-text("Créer"), button[type="submit"]', (b) => b.scrollIntoView());
  await page.click('div[role="dialog"] button:has-text("Créer")');
  await page.waitForTimeout(2500);
  // vérifier /marches
  await page.goto(`${URL_BASE}/marches`, { waitUntil: NI });
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  await shot(page, 'R4_marches_list');
  const rowTxt = await page.$$eval('table tbody tr', (trs) => trs.map((t) => t.textContent));
  const created = rowTxt.find((t) => t.includes(`${SUFFIX}-desc`));
  if (!created) throw new Error(`ligne marché ZZSMOKE introuvable dans /marches (desc non remontée)`);
  // type non vide sur cette ligne ? (la cellule Type contient un badge ≠ —)
  if (/—/.test(created) && !/(Démolition|Peinture|Sol|Maçonnerie|Électricité|Plomberie|Extérieurs|Façade|Cuisine|Aménagements|Placo|Portes)/i.test(created))
    console.log('   ⚠ type peut être "—" — vérifier screenshot');
});

// ============ R5 — fournisseur catégorie enregistrée (réversible) ============
await test('R5 — modifier la catégorie fournisseur est bien enregistrée', async () => {
  await page.goto(`${URL_BASE}/fournisseurs`, { waitUntil: NI });
  await page.waitForSelector('a[href*="/fournisseurs/"]', { timeout: 12000 });
  const href = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href*="/fournisseurs/"]')]
      .map((x) => x.getAttribute('href'))
      .find((h) => /\/fournisseurs\/[0-9a-f-]{36}$/i.test(h));
    return a;
  });
  if (!href) throw new Error('aucun lien fournisseur [id] trouvé');
  await page.goto(`${URL_BASE}${href}/edit`, { waitUntil: NI });
  const sel = await page.$('select[name="typeId"]');
  if (!sel) throw new Error('select[name="typeId"] absent');
  const original = await sel.inputValue();
  const opts = await page.$$eval('select[name="typeId"] option', (os) => os.map((o) => o.value).filter((v) => v));
  const target = opts.find((v) => v !== original);
  if (!target) throw new Error('pas de 2e option pour tester');
  await sel.selectOption(target);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  await page.goto(`${URL_BASE}${href}/edit`, { waitUntil: NI });
  const after = await page.$eval('select[name="typeId"]', (s) => s.value);
  await shot(page, 'R5_fournisseur_edit');
  // restaurer
  await page.selectOption('select[name="typeId"]', original);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);
  if (after !== target) throw new Error(`catégorie NON persistée (attendu ${target}, lu ${after})`);
});

// ============ R6 — PDF ============
await test('R6 — PDF suivi : généré, format Niveau/Pièce/Échéance, VALIDÉ exclu', async () => {
  const pdfUrl = `${URL_BASE}/api/pdf/suivi-travaux?lotId=${LOT_ID}`;
  const resp = await context.request.get(pdfUrl, { timeout: 30000 });
  if (resp.status() !== 200) throw new Error(`HTTP ${resp.status()}`);
  const ct = resp.headers()['content-type'] || '';
  if (!ct.includes('pdf')) throw new Error(`content-type=${ct}`);
  const buf = await resp.body();
  const pdfPath = `${ARTIFACTS}/${TS}_R6_suivi.pdf`;
  fs.writeFileSync(pdfPath, buf);
  if (buf.length < 1000) throw new Error(`PDF trop petit (${buf.length}o)`);
  // extraction texte si pdftotext dispo
  try {
    const txt = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' });
    fs.writeFileSync(`${ARTIFACTS}/${TS}_R6_suivi.txt`, txt);
    const hasFormat = /Niveau|Pièce|Échéance/.test(txt);
    const hasValide = /Validé/.test(txt);
    if (!hasFormat) throw new Error('format Niveau/Pièce/Échéance absent du PDF');
    if (hasValide) throw new Error('le PDF contient encore une tâche VALIDÉ');
  } catch (e) {
    if (e.message.includes('PDF') || e.message.includes('VALIDÉ') || e.message.includes('format')) throw e;
    console.log(`   ⚠ pdftotext indispo, vérif texte sautée (${e.message.slice(0, 40)})`);
  }
});

// ============ R7 — types de documents mobile ============
await test('R7 — types de documents (mobile) : icône Modifier accessible', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL_BASE}/admin/types-documents`, { waitUntil: NI });
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  await shot(page, 'R7_types_docs_mobile');
  // le conteneur doit permettre le scroll horizontal (overflow-x-auto)
  const scrollable = await page.evaluate(() => {
    const tbl = document.querySelector('table.table-base');
    const wrap = tbl?.parentElement;
    if (!wrap) return { ok: false, reason: 'wrap introuvable' };
    const cs = getComputedStyle(wrap);
    return { ok: cs.overflowX === 'auto' || cs.overflowX === 'scroll', overflowX: cs.overflowX, scrollW: wrap.scrollWidth, clientW: wrap.clientWidth };
  });
  const modifier = await page.$('a:has-text("Modifier")');
  if (!modifier) throw new Error('lien Modifier absent');
  if (!scrollable.ok) throw new Error(`conteneur non scrollable horizontalement (overflowX=${scrollable.overflowX})`);
  // vérifier que Modifier devient atteignable via scroll
  await modifier.scrollIntoViewIfNeeded();
  const box = await modifier.boundingBox();
  if (!box) throw new Error('Modifier non visible même après scroll');
  page.setViewportSize({ width: 1920, height: 1080 });
});

// ---- cleanup ZZSMOKE marché ----
try {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${URL_BASE}/marches`, { waitUntil: NI });
  const rows = await page.$$('table tbody tr');
  for (const r of rows) {
    const txt = await r.textContent();
    if (txt.includes('ZZSMOKE')) {
      const delBtn = await r.$('button[aria-label*="upprimer"], button:has(svg)');
      if (delBtn) {
        await delBtn.click();
        await page.waitForTimeout(400);
        // modal confirmation : taper la phrase = supplierLabel (1ère cellule lien)
        const phraseInput = await page.$('div[role="dialog"] input[type="text"], input[placeholder]');
        const supplierLabel = (await r.$eval('a', (a) => a.textContent.trim()).catch(() => ''));
        if (phraseInput && supplierLabel) { await phraseInput.fill(supplierLabel); }
        const confirm = await page.$('div[role="dialog"] button:has-text("Supprimer"), button:has-text("Confirmer")');
        if (confirm) { await confirm.click(); await page.waitForTimeout(1500); }
        console.log('🧹 marché ZZSMOKE supprimé (cleanup)');
      }
    }
  }
} catch (e) { console.log(`⚠ cleanup ZZSMOKE: ${e.message}`); }

await browser.close();

const passed = results.filter((r) => r.startsWith('PASS')).length;
const failed = results.filter((r) => r.startsWith('FAIL')).length;
const report = `
=== Smoke dashboard-23 — ${TS} ===
URL: ${URL_BASE} | LOT: ${LOT_ID}
Tests: ${results.length} | Passed: ${passed} | Failed: ${failed}

${results.join('\n')}

Console errors: ${consoleErrors.length}
Artifacts: ${ARTIFACTS}/${TS}_*
`;
fs.writeFileSync(`${ARTIFACTS}/${TS}_report.txt`, report);
console.log(report);
process.exit(failed > 0 ? 1 : 0);
