// isUploadKeyFor : n'accepte que la clé que /api/upload produit pour ce parent.
// Usage : npx tsx tests/check-storage-keys.ts
import assert from 'node:assert/strict';
import { isUploadKeyFor } from '../src/lib/storage/keys';

const co = '11111111-1111-1111-1111-111111111111';
const other = '22222222-2222-2222-2222-222222222222';
assert.ok(isUploadKeyFor(`Companies/valrose/${co}/1730800000000-devis.pdf`, 'Companies', co));
assert.ok(isUploadKeyFor(`Marches/tache-photos/${co}/1730800000000-photo.jpg`, 'Marches', co));
// clé d'un autre parent, d'un autre dossier, ou trafiquée : refusée
assert.ok(!isUploadKeyFor(`Companies/fka/${other}/1730800000000-statuts.pdf`, 'Companies', co));
assert.ok(!isUploadKeyFor(`Suppliers/dupont/${co}/1730800000000-rib.pdf`, 'Companies', co));
assert.ok(!isUploadKeyFor(`Companies/valrose/${co}/../${other}/x.pdf`, 'Companies', co));
assert.ok(!isUploadKeyFor(`Companies/valrose/${co}/`, 'Companies', co));
assert.ok(!isUploadKeyFor('x', 'Companies', co));
console.log('ok : isUploadKeyFor');
