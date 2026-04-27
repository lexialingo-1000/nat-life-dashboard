import { Client as MinioClient } from 'minio';

let _minio: MinioClient | null = null;

export function getMinio(): MinioClient {
  if (_minio) return _minio;
  const endpoint = process.env.MINIO_ENDPOINT;
  if (!endpoint) {
    throw new Error('MINIO_ENDPOINT is not set');
  }
  const url = new URL(endpoint);
  _minio = new MinioClient({
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
    useSSL: process.env.MINIO_USE_SSL === 'true' || url.protocol === 'https:',
    accessKey: process.env.MINIO_ACCESS_KEY!,
    secretKey: process.env.MINIO_SECRET_KEY!,
    region: process.env.MINIO_REGION ?? 'eu-west-1',
  });
  return _minio;
}

export const BUCKET = process.env.MINIO_BUCKET ?? 'nat-life';

/**
 * Génère un préfixe MinIO sain à partir d'un nom métier.
 * Ex : "Plomberie Dupont & Fils" → "Plomberie-Dupont-et-Fils"
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'et')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Construit la clé d'objet MinIO selon l'arborescence du projet.
 * Ex : storageKey('suppliers', { name: 'Plomberie Dupont' }, 'rib.pdf')
 *      → 'Suppliers/Plomberie-Dupont/rib.pdf'
 */
export type StorageScope =
  | 'companies'
  | 'suppliers'
  | 'customers'
  | 'properties'
  | 'lots'
  | 'marches'
  | 'locations';

export function buildStoragePrefix(scope: StorageScope, name: string): string {
  const folder = scope.charAt(0).toUpperCase() + scope.slice(1);
  return `${folder}/${slugify(name)}`;
}

export async function ensureBucket(): Promise<void> {
  const minio = getMinio();
  const exists = await minio.bucketExists(BUCKET);
  if (!exists) {
    await minio.makeBucket(BUCKET, process.env.MINIO_REGION ?? 'eu-west-1');
    console.log(`[minio] bucket ${BUCKET} created`);
  }
}

/**
 * Génère une URL signée pour upload direct depuis le frontend (PUT).
 */
export async function getPresignedUploadUrl(key: string, expiresInSeconds = 600): Promise<string> {
  return getMinio().presignedPutObject(BUCKET, key, expiresInSeconds);
}

/**
 * Génère une URL signée pour télécharger un fichier (GET).
 */
export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  return getMinio().presignedGetObject(BUCKET, key, expiresInSeconds);
}
