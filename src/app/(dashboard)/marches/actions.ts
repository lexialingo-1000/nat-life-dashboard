'use server';

import { db } from '@/db/client';
import { marchesTravaux, marcheLotAffectations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildStoragePrefix } from '@/lib/storage/minio';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const marcheStatusValues = [
  'devis_recu',
  'signe',
  'en_cours',
  'livre',
  'conteste',
  'annule',
] as const;

const marcheBaseSchema = z.object({
  propertyId: z.string().uuid(),
  supplierId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional().or(z.literal('')),
  amountHt: z
    .preprocess(
      (v) => (v === '' || v == null ? null : Number(v)),
      z.number().nonnegative().nullable()
    )
    .optional(),
  amountTtc: z
    .preprocess(
      (v) => (v === '' || v == null ? null : Number(v)),
      z.number().nonnegative().nullable()
    )
    .optional(),
  dateDevis: z.string().optional().or(z.literal('')),
  dateSignature: z.string().optional().or(z.literal('')),
  dateDebutPrevu: z.string().optional().or(z.literal('')),
  dateFinPrevu: z.string().optional().or(z.literal('')),
  status: z.enum(marcheStatusValues).default('devis_recu'),
  notes: z.string().optional().or(z.literal('')),
});

function parseLotIds(formData: FormData): string[] {
  const ids = formData.getAll('lotIds');
  return ids
    .map((v) => String(v))
    .filter((v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
}

export async function createMarcheAction(formData: FormData): Promise<void> {
  const parsed = marcheBaseSchema.safeParse({
    propertyId: formData.get('propertyId'),
    supplierId: formData.get('supplierId'),
    name: formData.get('name'),
    description: formData.get('description'),
    amountHt: formData.get('amountHt'),
    amountTtc: formData.get('amountTtc'),
    dateDevis: formData.get('dateDevis'),
    dateSignature: formData.get('dateSignature'),
    dateDebutPrevu: formData.get('dateDebutPrevu'),
    dateFinPrevu: formData.get('dateFinPrevu'),
    status: formData.get('status') ?? 'devis_recu',
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const data = parsed.data;
  const lotIds = parseLotIds(formData);

  const inserted = await db
    .insert(marchesTravaux)
    .values({
      propertyId: data.propertyId,
      supplierId: data.supplierId,
      name: data.name,
      description: data.description || null,
      amountHt: data.amountHt != null ? String(data.amountHt) : null,
      amountTtc: data.amountTtc != null ? String(data.amountTtc) : null,
      dateDevis: data.dateDevis || null,
      dateSignature: data.dateSignature || null,
      dateDebutPrevu: data.dateDebutPrevu || null,
      dateFinPrevu: data.dateFinPrevu || null,
      status: data.status,
      notes: data.notes || null,
      storagePath: buildStoragePrefix('marches', data.name),
    })
    .returning({ id: marchesTravaux.id });

  const marcheId = inserted[0].id;

  if (lotIds.length > 0) {
    await db.insert(marcheLotAffectations).values(
      lotIds.map((lotId) => ({
        marcheId,
        lotId,
      }))
    );
  }

  revalidatePath(`/biens/properties/${data.propertyId}`);
  revalidatePath('/marches');
  redirect(`/marches/${marcheId}`);
}

const marcheUpdateSchema = marcheBaseSchema.extend({
  id: z.string().uuid(),
});

export async function updateMarcheAction(formData: FormData): Promise<void> {
  const parsed = marcheUpdateSchema.safeParse({
    id: formData.get('id'),
    propertyId: formData.get('propertyId'),
    supplierId: formData.get('supplierId'),
    name: formData.get('name'),
    description: formData.get('description'),
    amountHt: formData.get('amountHt'),
    amountTtc: formData.get('amountTtc'),
    dateDevis: formData.get('dateDevis'),
    dateSignature: formData.get('dateSignature'),
    dateDebutPrevu: formData.get('dateDebutPrevu'),
    dateFinPrevu: formData.get('dateFinPrevu'),
    status: formData.get('status') ?? 'devis_recu',
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const { id, ...data } = parsed.data;
  const lotIds = parseLotIds(formData);

  await db
    .update(marchesTravaux)
    .set({
      propertyId: data.propertyId,
      supplierId: data.supplierId,
      name: data.name,
      description: data.description || null,
      amountHt: data.amountHt != null ? String(data.amountHt) : null,
      amountTtc: data.amountTtc != null ? String(data.amountTtc) : null,
      dateDevis: data.dateDevis || null,
      dateSignature: data.dateSignature || null,
      dateDebutPrevu: data.dateDebutPrevu || null,
      dateFinPrevu: data.dateFinPrevu || null,
      status: data.status,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(marchesTravaux.id, id));

  // Resync affectations : delete all, re-insert
  await db.delete(marcheLotAffectations).where(eq(marcheLotAffectations.marcheId, id));
  if (lotIds.length > 0) {
    await db.insert(marcheLotAffectations).values(
      lotIds.map((lotId) => ({
        marcheId: id,
        lotId,
      }))
    );
  }

  revalidatePath(`/marches/${id}`);
  revalidatePath(`/biens/properties/${data.propertyId}`);
  revalidatePath('/marches');
  redirect(`/marches/${id}`);
}

export async function deleteMarcheAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  const rows = await db
    .select({ propertyId: marchesTravaux.propertyId })
    .from(marchesTravaux)
    .where(eq(marchesTravaux.id, id))
    .limit(1);

  await db.delete(marchesTravaux).where(eq(marchesTravaux.id, id));

  if (rows[0]?.propertyId) {
    revalidatePath(`/biens/properties/${rows[0].propertyId}`);
  }
  revalidatePath('/marches');
  redirect('/marches');
}
