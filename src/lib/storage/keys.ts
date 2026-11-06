/**
 * Une clé MinIO reçue d'un formulaire est-elle bien celle que /api/upload a produite pour CE parent ?
 * Format de /api/upload : `<Folder>/<slug>/<parentId>/<horodatage>-<fichier>`.
 * Sans ce contrôle, une action qui enregistre la clé du client puis efface l'ancienne permet
 * d'effacer n'importe quel fichier du bucket (revue sécurité du 05/11/2026).
 * Contrôle : tests/check-storage-keys.ts.
 */
export function isUploadKeyFor(key: string, folder: string, parentId: string): boolean {
  const parts = key.split('/');
  return (
    parts.length === 4 &&
    parts[0] === folder &&
    parts[2] === parentId &&
    parts.every((p) => p !== '' && p !== '.' && p !== '..')
  );
}
