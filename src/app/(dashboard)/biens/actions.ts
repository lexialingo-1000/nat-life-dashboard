'use server';

import { db } from '@/db/client';
import { lots } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const lotUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: z.enum(['appartement', 'maison', 'garage', 'immeuble', 'terrain']),
  status: z.enum(['vacant', 'loue_annuel', 'loue_saisonnier', 'travaux']),
  surfaceCarrez: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
      z.number().nonnegative().nullable()
    )
    .optional(),
  surfaceBoutin: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
      z.number().nonnegative().nullable()
    )
    .optional(),
  notes: z.string().optional().or(z.literal('')),
});

export async function updateLotAction(formData: FormData): Promise<void> {
  const parsed = lotUpdateSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    type: formData.get('type'),
    status: formData.get('status'),
    surfaceCarrez: formData.get('surfaceCarrez'),
    surfaceBoutin: formData.get('surfaceBoutin'),
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const { id, surfaceCarrez, surfaceBoutin, notes, ...rest } = parsed.data;

  await db
    .update(lots)
    .set({
      ...rest,
      surfaceCarrez: surfaceCarrez != null ? String(surfaceCarrez) : null,
      surfaceBoutin: surfaceBoutin != null ? String(surfaceBoutin) : null,
      notes: notes || null,
      updatedAt: new Date(),
    })
    .where(eq(lots.id, id));

  revalidatePath(`/biens/lots/${id}`);
  redirect(`/biens/lots/${id}`);
}
