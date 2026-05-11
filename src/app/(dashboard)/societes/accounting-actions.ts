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

const uploadSchema = z.object({
  companyId: z.string().uuid(),
  supplierId: z.string().uuid(),
  marcheId: z
    .preprocess((v) => (v === '' || v == null ? null : v), z.string().uuid().nullable())
    .optional(),
  kind: z.enum(KIND_VALUES),
  name: z.string().min(1).max(255),
  storageKey: z.string().min(1),
  documentDate: z.string().optional().or(z.literal('')),
  amountHt: moneyField,
  amountTtc: moneyField,
  notes: z.string().optional().or(z.literal('')),
});

function toNumericString(n: number | null | undefined): string | null {
  return n != null ? String(n) : null;
}

export async function uploadAccountingDocAction(formData: FormData): Promise<void> {
  const parsed = uploadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;
  await db.insert(companyAccountingDocuments).values({
    companyId: data.companyId,
    supplierId: data.supplierId,
    marcheId: data.marcheId ?? null,
    kind: data.kind,
    name: data.name,
    storageKey: data.storageKey,
    documentDate: data.documentDate || null,
    amountHt: toNumericString(data.amountHt ?? null),
    amountTtc: toNumericString(data.amountTtc ?? null),
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
