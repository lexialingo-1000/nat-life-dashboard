// Garde anti-redirection ouverte (revue sécu lot C, 25/11/2026). `npx tsx tests/check-safe-return-to.ts`
import assert from 'node:assert/strict';
import { safeReturnTo } from '../src/lib/safe-return-to';

const F = '/fallback';
for (const bad of ['//evil.com', '/\\evil.com', '/\t/evil.com', '/\n/x', 'https://evil.com', 'javascript:alert(1)', '', undefined]) {
  assert.equal(safeReturnTo(bad, F), F, `doit refuser ${JSON.stringify(bad)}`);
}
assert.equal(safeReturnTo('/societes/abc?tab=biens', F), '/societes/abc?tab=biens');
console.log('ok : safeReturnTo');
