// Probe ciblé widget L1 sur accueil — vérifie que les sociétés sans KBis apparaissent
// après UPDATE document_types.is_required=true sur 'kbis' scope=company.

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const playwrightPath = (() => {
  const cjs = require.resolve('playwright');
  const mjs = cjs.replace(/index\.(c?js)$/, 'index.mjs');
  return fs.existsSync(mjs) ? mjs : cjs;
})();
const { chromium } = await import(pathToFileURL(playwrightPath).href);

const ARTIFACTS = '/tmp/natlife-qa';
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const URL_BASE = 'https://dashboard.fka-holding.com';
const STORAGE_STATE = path.join(ARTIFACTS, 'storage-state.json');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  storageState: STORAGE_STATE,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});
const page = await context.newPage();

await page.goto(`${URL_BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${ARTIFACTS}/${TS}_l1_widget_accueil.png`, fullPage: true });

const html = await page.content();

// Cherche les patterns attendus
const expectedCompanies = [
  'HAKA', 'HEPHALAB', 'KAPIMMO', 'RP BRUNET', 'SCI ANTHEA',
  'SCI DU CHALET', 'SCI KAZAM', 'SCI VALROSE', 'TRAMEXIA',
];

const found = expectedCompanies.filter((c) => html.includes(c));
const missingCount = (html.match(/Manquant/gi) || []).length;
const widgetPresent = /Documents\s*obligatoires|Action\s*requise|KBis/i.test(html);

console.log(`Widget présent : ${widgetPresent}`);
console.log(`Sociétés trouvées (sur 9 attendues) : ${found.length} — ${found.join(', ')}`);
console.log(`Occurrences "Manquant" dans HTML : ${missingCount}`);

// Cherche les links vers les sociétés
const socLinks = await page.$$eval('a[href^="/societes/"]', (as) =>
  as.map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim() }))
);
const widgetSocLinks = socLinks.filter((l) =>
  expectedCompanies.some((c) => l.text.includes(c))
);
console.log(`Links accueil → /societes/[id] sur ces sociétés : ${widgetSocLinks.length}`);
widgetSocLinks.slice(0, 5).forEach((l) => console.log(`  ${l.text} → ${l.href}`));

await browser.close();

if (found.length >= 5 && missingCount >= 3) {
  console.log('\n✅ L1 widget OK — sociétés sans KBis remontent en accueil');
  process.exit(0);
} else {
  console.log('\n❌ L1 widget NON fonctionnel — sociétés attendues absentes ou pas en "Manquant"');
  process.exit(1);
}
