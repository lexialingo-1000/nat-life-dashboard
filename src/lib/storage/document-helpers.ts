'use server';

import { getMinio, getPresignedDownloadUrl, BUCKET } from './minio';

/**
 * Génère une URL signée GET pour télécharger un document.
 * Utilisée par les server actions de chaque entité (supplier, customer, etc.).
 */
export async function getDownloadUrl(storageKey: string): Promise<string> {
  return getPresignedDownloadUrl(storageKey, 3600);
}

/**
 * Supprime un objet MinIO. Tolérant aux erreurs (objet déjà absent).
 */
export async function deleteObject(storageKey: string): Promise<void> {
  try {
    await getMinio().removeObject(BUCKET, storageKey);
  } catch (e) {
    console.warn(`[minio] removeObject ${storageKey} failed:`, e);
  }
}
