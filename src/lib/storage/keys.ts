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

/** Dossier MinIO des pièces jointes de contrat d'un lot (Retours 24/11/2026 pt 7) :
 *  `/api/upload` avec scope `lots`, parentSlug `contrats`, parentId = id du lot. */
export const LOT_CONTRACT_SLUG = 'contrats';

/**
 * Clé de pièce jointe d'un contrat de CE lot. Plus strict que isUploadKeyFor(key, 'Lots', lotId) :
 * une clé de document du lot (`Lots/<bien-lot>/<lotId>/…`) est refusée, sinon supprimer le contrat
 * effacerait le fichier du document.
 */
export function isLotContractKey(key: string, lotId: string): boolean {
  return isUploadKeyFor(key, 'Lots', lotId) && key.split('/')[1] === LOT_CONTRACT_SLUG;
}
