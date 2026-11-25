'use server';

// Retours 24/11/2026 pt 7 — contrats d'un lot (onglet « Contrats » de la fiche lot).
// Création / édition ouvertes aux gestionnaires (comme les documents du lot), suppression
// réservée aux admins. Pièce jointe : envoyée par /api/upload (scope `lots`, parentSlug
// `contrats`, parentId = lot) puis contrôlée ici par isLotContractKey.

import { requireAdmin } from '@/lib/auth/role';
import { db } from '@/db/client';
import { contractTypes, lotContracts, lots } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isLotContractKey } from '@/lib/storage/keys';
import { getDownloadUrl, deleteObject } from '@/lib/storage/document-helpers';

export type LotContractActionResult = { ok: true } | { error: string };

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
  .optional()
  .or(z.literal(''));
const optionalText = (max: number) => z.string().max(max).optional().or(z.literal(''));

const contractFields = {
  typeId: z.string().uuid('Type de contrat obligatoire'),
  startDate: optionalDate,
  endDate: optionalDate,
  contractNumber: optionalText(255),
  customerNumber: optionalText(255),
  comment: optionalText(2000),
  storageKey: optionalText(1024),
  fileName: optionalText(255),
};

const createSchema = z.object({ lotId: z.string().uuid(), ...contractFields });
const updateSchema = z.object({
  id: z.string().uuid(),
  removeAttachment: z.literal('1').optional().or(z.literal('')),
  ...contractFields,
});

function formError(e: z.ZodError): { error: string } {
  return { error: e.errors.map((x) => x.message).join(', ') };
}

function datesError(startDate?: string, endDate?: string): string | null {
  if (startDate && endDate && endDate < startDate) {
    return 'La date de fin est antérieure à la date de début.';
  }
  return null;
}

/** Le type doit exister et être actif, sauf s'il est inchangé (édition d'un contrat ancien). */
async function typeError(typeId: string, currentTypeId?: string): Promise<string | null> {
  const [t] = await db
    .select({ isActive: contractTypes.isActive })
    .from(contractTypes)
    .where(eq(contractTypes.id, typeId))
    .limit(1);
  if (!t) return 'Type de contrat introuvable.';
  if (!t.isActive && typeId !== currentTypeId) return 'Ce type de contrat est désactivé.';
  return null;
}

export async function createLotContractAction(
  formData: FormData,
): Promise<LotContractActionResult> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(parsed.error);
  const data = parsed.data;

  const dErr = datesError(data.startDate, data.endDate);
  if (dErr) return { error: dErr };

  const [lot] = await db.select({ id: lots.id }).from(lots).where(eq(lots.id, data.lotId)).limit(1);
  if (!lot) return { error: 'Lot introuvable.' };

  const tErr = await typeError(data.typeId);
  if (tErr) return { error: tErr };

  // Seulement un fichier envoyé pour les contrats de CE lot (sinon supprimer le contrat
  // effacerait un fichier qui ne lui appartient pas).
  if (data.storageKey && !isLotContractKey(data.storageKey, data.lotId)) {
    return { error: 'Pièce jointe invalide.' };
  }

  await db.insert(lotContracts).values({
    lotId: data.lotId,
    typeId: data.typeId,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    contractNumber: data.contractNumber?.trim() || null,
    customerNumber: data.customerNumber?.trim() || null,
    comment: data.comment?.trim() || null,
    storageKey: data.storageKey || null,
    fileName: data.storageKey ? data.fileName?.trim() || null : null,
  });

  revalidatePath(`/biens/lots/${data.lotId}`);
  return { ok: true };
}

export async function updateLotContractAction(
  formData: FormData,
): Promise<LotContractActionResult> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(parsed.error);
  const data = parsed.data;

  const [existing] = await db
    .select({
      lotId: lotContracts.lotId,
      typeId: lotContracts.typeId,
      storageKey: lotContracts.storageKey,
      fileName: lotContracts.fileName,
    })
    .from(lotContracts)
    .where(eq(lotContracts.id, data.id))
    .limit(1);
  if (!existing) return { error: 'Contrat introuvable.' };

  const dErr = datesError(data.startDate, data.endDate);
  if (dErr) return { error: dErr };

  const tErr = await typeError(data.typeId, existing.typeId);
  if (tErr) return { error: tErr };

  // Pièce jointe : nouveau fichier (remplace), retrait explicite, ou inchangée.
  let storageKey = existing.storageKey;
  let fileName = existing.fileName;
  if (data.storageKey) {
    if (!isLotContractKey(data.storageKey, existing.lotId)) {
      return { error: 'Pièce jointe invalide.' };
    }
    storageKey = data.storageKey;
    fileName = data.fileName?.trim() || null;
  } else if (data.removeAttachment === '1') {
    storageKey = null;
    fileName = null;
  }

  await db
    .update(lotContracts)
    .set({
      typeId: data.typeId,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      contractNumber: data.contractNumber?.trim() || null,
      customerNumber: data.customerNumber?.trim() || null,
      comment: data.comment?.trim() || null,
      storageKey,
      fileName,
      updatedAt: new Date(),
    })
    .where(eq(lotContracts.id, data.id));

  // Ancien fichier remplacé ou retiré : effacé après l'écriture (best effort).
  if (existing.storageKey && existing.storageKey !== storageKey) {
    await deleteObject(existing.storageKey);
  }

  revalidatePath(`/biens/lots/${existing.lotId}`);
  return { ok: true };
}

export async function deleteLotContractAction(
  formData: FormData,
): Promise<void | { error: string }> {
  await requireAdmin();
  const parsed = z.string().uuid().safeParse(formData.get('id'));
  if (!parsed.success) return { error: 'ID invalide' };

  const [existing] = await db
    .select({ lotId: lotContracts.lotId, storageKey: lotContracts.storageKey })
    .from(lotContracts)
    .where(eq(lotContracts.id, parsed.data))
    .limit(1);
  if (!existing) return { error: 'Contrat introuvable.' };

  await db.delete(lotContracts).where(eq(lotContracts.id, parsed.data));
  if (existing.storageKey) await deleteObject(existing.storageKey);

  revalidatePath(`/biens/lots/${existing.lotId}`);
}

/** URL signée de la pièce jointe, retrouvée par l'id du contrat (jamais une clé fournie par le client). */
export async function getLotContractFileUrlAction(
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const parsed = z.string().uuid().safeParse(formData.get('id'));
  if (!parsed.success) return { error: 'ID invalide' };

  const [row] = await db
    .select({ storageKey: lotContracts.storageKey })
    .from(lotContracts)
    .where(eq(lotContracts.id, parsed.data))
    .limit(1);
  if (!row?.storageKey) return { error: 'Aucune pièce jointe' };

  try {
    return { url: await getDownloadUrl(row.storageKey) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur MinIO' };
  }
}
