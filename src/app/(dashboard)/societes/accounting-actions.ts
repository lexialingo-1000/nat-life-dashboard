'use server';

import { db } from '@/db/client';
import { companyAccountingDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getDownloadUrl, deleteObject } from '@/lib/storage/document-helpers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const KIND_VALUES = ['devis', 'commande', 'facture'] as const;

const moneyField = z
  .preprocess(
    (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.'))),
    z.number().nonnegative().nullable()
  )
  .optional();

const uuidOrNull = z
  .preprocess((v) => (v === '' || v == null ? null : v), z.string().uuid().nullable())
  .optional();

const uploadSchema = z.object({
  companyId: z.string().uuid(),
  supplierId: z.string().uuid(),
  marcheId: uuidOrNull,
  kind: z.enum(KIND_VALUES),
  name: z.string().min(1).max(255),
  storageKey: z.string().min(1),
  // V1.10 §8 — nom de fichier original capturé côté client.
  originalFilename: z.string().optional().or(z.literal('')),
  documentDate: z.string().optional().or(z.literal('')),
  amountHt: moneyField,
  amountTtc: moneyField,
  // V1.10 §4 §5 — liens optionnels devis↔commande↔facture. Forcés null
  // server-side selon kind (cf. enforceParentByKind ci-dessous).
  parentDevisId: uuidOrNull,
  parentCommandeId: uuidOrNull,
  notes: z.string().optional().or(z.literal('')),
});

function toNumericString(n: number | null | undefined): string | null {
  return n != null ? String(n) : null;
}

// V1.10 — parent_devis_id valide pour commande/facture seulement,
// parent_commande_id valide pour facture seulement. Force null sinon.
function enforceParentByKind(
  kind: (typeof KIND_VALUES)[number],
  parentDevisId: string | null | undefined,
  parentCommandeId: string | null | undefined
): { parentDevisId: string | null; parentCommandeId: string | null } {
  if (kind === 'devis') {
    return { parentDevisId: null, parentCommandeId: null };
  }
  if (kind === 'commande') {
    return { parentDevisId: parentDevisId ?? null, parentCommandeId: null };
  }
  return {
    parentDevisId: parentDevisId ?? null,
    parentCommandeId: parentCommandeId ?? null,
  };
}

export async function uploadAccountingDocAction(formData: FormData): Promise<void> {
  const parsed = uploadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;
  const parents = enforceParentByKind(data.kind, data.parentDevisId, data.parentCommandeId);
  await db.insert(companyAccountingDocuments).values({
    companyId: data.companyId,
    supplierId: data.supplierId,
    marcheId: data.marcheId ?? null,
    kind: data.kind,
    name: data.name,
    storageKey: data.storageKey,
    originalFilename: data.originalFilename || null,
    documentDate: data.documentDate || null,
    amountHt: toNumericString(data.amountHt ?? null),
    amountTtc: toNumericString(data.amountTtc ?? null),
    parentDevisId: parents.parentDevisId,
    parentCommandeId: parents.parentCommandeId,
    notes: data.notes || null,
  });
  revalidatePath(`/societes/${data.companyId}`);
}

export async function deleteAccountingDocAction(formData: FormData): Promise<void> {
  const documentId = String(formData.get('documentId') ?? '');
  const companyId = String(formData.get('companyId') ?? '');
  if (!documentId || !companyId) throw new Error('IDs manquants');

  const rows = await db
    .select({ storageKey: companyAccountingDocuments.storageKey })
    .from(companyAccountingDocuments)
    .where(eq(companyAccountingDocuments.id, documentId))
    .limit(1);

  if (rows[0]?.storageKey) {
    try {
      await deleteObject(rows[0].storageKey);
    } catch {
      // MinIO down ou clé déjà inexistante — on supprime quand même la ligne DB.
    }
  }

  await db.delete(companyAccountingDocuments).where(eq(companyAccountingDocuments.id, documentId));
  revalidatePath(`/societes/${companyId}`);
}

// V12bis umbrella §2 — modifier un devis/commande/facture.
// V1.10 §1 — accepte newStorageKey + newOriginalFilename pour remplacer la PJ
//            (delete ancien object MinIO + update colonnes).
// V1.10 §4 §5 — accepte parentDevisId / parentCommandeId (filtrés par kind).
const updateSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  supplierId: z.string().uuid(),
  marcheId: uuidOrNull,
  kind: z.enum(KIND_VALUES),
  name: z.string().min(1).max(255),
  documentDate: z.string().optional().or(z.literal('')),
  amountHt: moneyField,
  amountTtc: moneyField,
  parentDevisId: uuidOrNull,
  parentCommandeId: uuidOrNull,
  newStorageKey: z.string().optional().or(z.literal('')),
  newOriginalFilename: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export async function updateAccountingDocAction(formData: FormData): Promise<void> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;
  const parents = enforceParentByKind(data.kind, data.parentDevisId, data.parentCommandeId);

  // V1.10 §1 — remplacement PJ.
  let storageKeyUpdate: { storageKey: string; originalFilename: string | null } | null = null;
  if (data.newStorageKey && data.newStorageKey.trim() !== '') {
    const existing = await db
      .select({ storageKey: companyAccountingDocuments.storageKey })
      .from(companyAccountingDocuments)
      .where(eq(companyAccountingDocuments.id, data.id))
      .limit(1);
    const oldKey = existing[0]?.storageKey;
    if (oldKey && oldKey !== data.newStorageKey) {
      try {
        await deleteObject(oldKey);
      } catch {
        // MinIO down ou clé orpheline — on continue et écrase la référence en DB.
      }
    }
    storageKeyUpdate = {
      storageKey: data.newStorageKey,
      originalFilename: data.newOriginalFilename || null,
    };
  }

  await db
    .update(companyAccountingDocuments)
    .set({
      supplierId: data.supplierId,
      marcheId: data.marcheId ?? null,
      kind: data.kind,
      name: data.name,
      documentDate: data.documentDate || null,
      amountHt: toNumericString(data.amountHt ?? null),
      amountTtc: toNumericString(data.amountTtc ?? null),
      parentDevisId: parents.parentDevisId,
      parentCommandeId: parents.parentCommandeId,
      notes: data.notes || null,
      ...(storageKeyUpdate ? storageKeyUpdate : {}),
    })
    .where(eq(companyAccountingDocuments.id, data.id));
  revalidatePath(`/societes/${data.companyId}`);
  revalidatePath(`/fournisseurs/${data.supplierId}`);
  if (data.marcheId) revalidatePath(`/marches/${data.marcheId}`);
  redirect(`/societes/${data.companyId}?tab=compta`);
}

export async function getAccountingDocUrlAction(
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  const storageKey = String(formData.get('storageKey') ?? '');
  if (!storageKey) return { error: 'Clé manquante' };
  try {
    const url = await getDownloadUrl(storageKey);
    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur MinIO' };
  }
}
