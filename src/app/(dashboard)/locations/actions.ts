'use server';

import { requireAdmin } from '@/lib/auth/role';
import { db } from '@/db/client';
import { locations, locationDocuments, locationPeriodiciteEnum } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getDownloadUrl, deleteObject } from '@/lib/storage/document-helpers';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { safeReturnTo } from '@/lib/safe-return-to';

const moneyField = z
  .preprocess(
    (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.'))),
    z.number().nonnegative().nullable(),
  )
  .optional();

const locationSchema = z.object({
  lotId: z.string().uuid(),
  customerId: z.string().uuid(),
  // Retours 24/11/2026 pt 6 — type = ligne de location_types (Paramètres), plus l'enum.
  typeId: z.string().uuid('Type de location requis'),
  dateDebut: z.string().min(1, 'Date de début requise'),
  dateFin: z.string().optional().or(z.literal('')),
  prixLocation: moneyField,
  depotGarantie: moneyField,
  chargesCourantes: moneyField,
  fraisMenage: moneyField,
  taxeSejour: moneyField,
  periodicite: z.enum(locationPeriodiciteEnum.enumValues).default('mois'),
  notes: z.string().optional().or(z.literal('')),
});

function toNumericString(n: number | null | undefined): string | null {
  return n != null ? String(n) : null;
}

export async function createLocationAction(formData: FormData): Promise<void> {
  const parsed = locationSchema.safeParse({
    lotId: formData.get('lotId'),
    customerId: formData.get('customerId'),
    typeId: formData.get('typeId'),
    dateDebut: formData.get('dateDebut'),
    dateFin: formData.get('dateFin'),
    prixLocation: formData.get('prixLocation'),
    depotGarantie: formData.get('depotGarantie'),
    chargesCourantes: formData.get('chargesCourantes'),
    fraisMenage: formData.get('fraisMenage'),
    taxeSejour: formData.get('taxeSejour'),
    periodicite: formData.get('periodicite') ?? 'mois',
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const data = parsed.data;

  const inserted = await db
    .insert(locations)
    .values({
      lotId: data.lotId,
      customerId: data.customerId,
      typeId: data.typeId,
      dateDebut: data.dateDebut,
      dateFin: data.dateFin || null,
      prixLocation: toNumericString(data.prixLocation ?? null),
      depotGarantie: toNumericString(data.depotGarantie ?? null),
      chargesCourantes: toNumericString(data.chargesCourantes ?? null),
      fraisMenage: toNumericString(data.fraisMenage ?? null),
      taxeSejour: toNumericString(data.taxeSejour ?? null),
      periodicite: data.periodicite,
      notes: data.notes || null,
    })
    .returning({ id: locations.id });

  revalidatePath('/locations');
  revalidatePath(`/biens/lots/${data.lotId}`);
  revalidatePath(`/clients/${data.customerId}`);

  const fallback = `/locations/${inserted[0].id}`;
  const returnTo = safeReturnTo(formData.get('returnTo'), fallback);
  redirect(returnTo);
}

const locationUpdateSchema = locationSchema.extend({ id: z.string().uuid() });

export async function updateLocationAction(formData: FormData): Promise<void> {
  const parsed = locationUpdateSchema.safeParse({
    id: formData.get('id'),
    lotId: formData.get('lotId'),
    customerId: formData.get('customerId'),
    typeId: formData.get('typeId'),
    dateDebut: formData.get('dateDebut'),
    dateFin: formData.get('dateFin'),
    prixLocation: formData.get('prixLocation'),
    depotGarantie: formData.get('depotGarantie'),
    chargesCourantes: formData.get('chargesCourantes'),
    fraisMenage: formData.get('fraisMenage'),
    taxeSejour: formData.get('taxeSejour'),
    periodicite: formData.get('periodicite') ?? 'mois',
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const data = parsed.data;

  await db
    .update(locations)
    .set({
      lotId: data.lotId,
      customerId: data.customerId,
      typeId: data.typeId,
      dateDebut: data.dateDebut,
      dateFin: data.dateFin || null,
      prixLocation: toNumericString(data.prixLocation ?? null),
      depotGarantie: toNumericString(data.depotGarantie ?? null),
      chargesCourantes: toNumericString(data.chargesCourantes ?? null),
      fraisMenage: toNumericString(data.fraisMenage ?? null),
      taxeSejour: toNumericString(data.taxeSejour ?? null),
      periodicite: data.periodicite,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(locations.id, data.id));

  revalidatePath('/locations');
  revalidatePath(`/locations/${data.id}`);
  revalidatePath(`/biens/lots/${data.lotId}`);
  revalidatePath(`/clients/${data.customerId}`);
  redirect(`/locations/${data.id}`);
}

export async function deleteLocationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  let lotId: string | null = null;
  let customerId: string | null = null;

  try {
    const rows = await db
      .select({ lotId: locations.lotId, customerId: locations.customerId })
      .from(locations)
      .where(eq(locations.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new Error('Location introuvable (peut-être déjà supprimée).');
    }
    lotId = rows[0].lotId;
    customerId = rows[0].customerId;

    const docs = await db
      .select({ storageKey: locationDocuments.storageKey })
      .from(locationDocuments)
      .where(eq(locationDocuments.locationId, id));

    for (const doc of docs) {
      try {
        await deleteObject(doc.storageKey);
      } catch {}
    }

    await db.delete(locationDocuments).where(eq(locationDocuments.locationId, id));
    await db.delete(locations).where(eq(locations.id, id));
  } catch (err) {
    logger.error(
      '[deleteLocationAction] id=%s lotId=%s customerId=%s err=',
      id,
      lotId,
      customerId,
      err,
    );
    const msg = err instanceof Error ? err.message : 'Erreur inconnue';
    throw new Error(`Suppression impossible : ${msg}`);
  }

  revalidatePath('/locations');
  if (lotId) revalidatePath(`/biens/lots/${lotId}`);
  if (customerId) revalidatePath(`/clients/${customerId}`);

  const returnTo = formData.get('returnTo');
  redirect(
    safeReturnTo(typeof returnTo === 'string' && returnTo ? returnTo : '/locations', '/locations'),
  );
}

const locationDocumentSchema = z.object({
  locationId: z.string().uuid(),
  typeId: z.string().uuid(),
  name: z.string().min(1).max(255),
  storageKey: z.string().min(1),
  documentDate: z.string().optional().or(z.literal('')),
  expiresAt: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  // V1.12 R1+R2 — col legacy `category` retirée. Catégorie héritée de document_types.
});

export async function uploadLocationDocumentAction(formData: FormData): Promise<void> {
  const parsed = locationDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;
  await db.insert(locationDocuments).values({
    locationId: data.locationId,
    typeId: data.typeId,
    name: data.name,
    storageKey: data.storageKey,
    documentDate: data.documentDate || null,
    expiresAt: data.expiresAt || null,
    notes: data.notes || null,
  });
  revalidatePath(`/locations/${data.locationId}`);
}

export async function deleteLocationDocumentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const documentId = String(formData.get('documentId') ?? '');
  const locationId = String(formData.get('locationId') ?? '');
  if (!documentId || !locationId) throw new Error('IDs manquants');

  const rows = await db
    .select({ storageKey: locationDocuments.storageKey })
    .from(locationDocuments)
    .where(eq(locationDocuments.id, documentId))
    .limit(1);

  if (rows[0]?.storageKey) {
    await deleteObject(rows[0].storageKey);
  }

  await db.delete(locationDocuments).where(eq(locationDocuments.id, documentId));
  revalidatePath(`/locations/${locationId}`);
}

export async function getLocationDocumentUrlAction(
  formData: FormData,
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
