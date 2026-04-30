'use server';

import { db } from '@/db/client';
import { locations, locationDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getDownloadUrl, deleteObject } from '@/lib/storage/document-helpers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const locationTypeValues = [
  'bail_meuble_annuel',
  'bail_nu_annuel',
  'saisonnier_direct',
  'saisonnier_plateforme',
] as const;

const locationPeriodiciteValues = [
  'forfait',
  'jour',
  'semaine',
  'mois',
  'annee',
] as const;

const moneyField = z
  .preprocess(
    (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.'))),
    z.number().nonnegative().nullable()
  )
  .optional();

const locationSchema = z.object({
  lotId: z.string().uuid(),
  customerId: z.string().uuid(),
  typeLocation: z.enum(locationTypeValues),
  dateDebut: z.string().min(1, 'Date de début requise'),
  dateFin: z.string().optional().or(z.literal('')),
  prixLocation: moneyField,
  depotGarantie: moneyField,
  chargesCourantes: moneyField,
  fraisMenage: moneyField,
  taxeSejour: moneyField,
  periodicite: z.enum(locationPeriodiciteValues).default('mois'),
  notes: z.string().optional().or(z.literal('')),
});

function safeReturnTo(value: unknown, fallback: string): string {
  const v = typeof value === 'string' ? value : '';
  if (!v.startsWith('/') || v.startsWith('//')) return fallback;
  return v;
}

function toNumericString(n: number | null | undefined): string | null {
  return n != null ? String(n) : null;
}

export async function createLocationAction(formData: FormData): Promise<void> {
  const parsed = locationSchema.safeParse({
    lotId: formData.get('lotId'),
    customerId: formData.get('customerId'),
    typeLocation: formData.get('typeLocation'),
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
      typeLocation: data.typeLocation,
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
    typeLocation: formData.get('typeLocation'),
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
      typeLocation: data.typeLocation,
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
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  const rows = await db
    .select({ lotId: locations.lotId, customerId: locations.customerId })
    .from(locations)
    .where(eq(locations.id, id))
    .limit(1);

  await db.delete(locations).where(eq(locations.id, id));

  revalidatePath('/locations');
  if (rows[0]) {
    revalidatePath(`/biens/lots/${rows[0].lotId}`);
    revalidatePath(`/clients/${rows[0].customerId}`);
  }

  const returnTo = formData.get('returnTo');
  if (typeof returnTo === 'string' && returnTo) {
    redirect(safeReturnTo(returnTo, '/locations'));
  }
}

const locationDocumentSchema = z.object({
  locationId: z.string().uuid(),
  typeId: z.string().uuid(),
  name: z.string().min(1).max(255),
  storageKey: z.string().min(1),
  documentDate: z.string().optional().or(z.literal('')),
  expiresAt: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
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
