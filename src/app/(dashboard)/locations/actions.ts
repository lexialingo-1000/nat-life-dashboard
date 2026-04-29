'use server';

import { db } from '@/db/client';
import { locations } from '@/db/schema';
import { eq } from 'drizzle-orm';
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

const locationSchema = z.object({
  lotId: z.string().uuid(),
  customerId: z.string().uuid(),
  typeLocation: z.enum(locationTypeValues),
  dateDebut: z.string().min(1, 'Date de début requise'),
  dateFin: z.string().optional().or(z.literal('')),
  prixLocation: z
    .preprocess(
      (v) => (v === '' || v == null ? null : Number(v)),
      z.number().nonnegative().nullable()
    )
    .optional(),
  depotGarantie: z
    .preprocess(
      (v) => (v === '' || v == null ? null : Number(v)),
      z.number().nonnegative().nullable()
    )
    .optional(),
  prix: z
    .preprocess(
      (v) => (v === '' || v == null ? null : Number(v)),
      z.number().nonnegative().nullable()
    )
    .optional(),
  periodicite: z.enum(locationPeriodiciteValues).default('mois'),
  notes: z.string().optional().or(z.literal('')),
});

function safeReturnTo(value: unknown, fallback: string): string {
  const v = typeof value === 'string' ? value : '';
  if (!v.startsWith('/') || v.startsWith('//')) return fallback;
  return v;
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
    prix: formData.get('prix'),
    periodicite: formData.get('periodicite') ?? 'mois',
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const data = parsed.data;

  await db.insert(locations).values({
    lotId: data.lotId,
    customerId: data.customerId,
    typeLocation: data.typeLocation,
    dateDebut: data.dateDebut,
    dateFin: data.dateFin || null,
    prixLocation: data.prixLocation != null ? String(data.prixLocation) : null,
    depotGarantie: data.depotGarantie != null ? String(data.depotGarantie) : null,
    prix: data.prix != null ? String(data.prix) : null,
    periodicite: data.periodicite,
    notes: data.notes || null,
  });

  revalidatePath(`/biens/lots/${data.lotId}`);
  revalidatePath(`/clients/${data.customerId}`);

  const fallback = `/biens/lots/${data.lotId}`;
  const returnTo = safeReturnTo(formData.get('returnTo'), fallback);
  redirect(returnTo);
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

  if (rows[0]) {
    revalidatePath(`/biens/lots/${rows[0].lotId}`);
    revalidatePath(`/clients/${rows[0].customerId}`);
  }
}
