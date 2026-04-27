'use server';

import { db } from '@/db/client';
import { properties } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const propertySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: z.enum(['appartement', 'maison', 'garage', 'immeuble', 'terrain']),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  postalCode: z.string().optional().or(z.literal('')),
  purchaseDate: z.string().optional().or(z.literal('')),
  purchasePrice: z.string().optional().or(z.literal('')),
  cadastre: z.string().optional().or(z.literal('')),
  notaireName: z.string().optional().or(z.literal('')),
  notaireEtude: z.string().optional().or(z.literal('')),
  notairePhone: z.string().optional().or(z.literal('')),
  notaireEmail: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export async function updatePropertyAction(formData: FormData): Promise<void> {
  const parsed = propertySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const { id, notaireName, notaireEtude, notairePhone, notaireEmail, purchasePrice, purchaseDate, ...rest } = parsed.data;

  const notaire =
    notaireName || notaireEtude || notairePhone || notaireEmail
      ? {
          name: notaireName || undefined,
          etude: notaireEtude || undefined,
          phone: notairePhone || undefined,
          email: notaireEmail || undefined,
        }
      : null;

  await db
    .update(properties)
    .set({
      ...rest,
      address: rest.address || null,
      city: rest.city || null,
      postalCode: rest.postalCode || null,
      cadastre: rest.cadastre || null,
      notes: rest.notes || null,
      purchaseDate: purchaseDate || null,
      purchasePrice: purchasePrice || null,
      notaire,
      updatedAt: new Date(),
    })
    .where(eq(properties.id, id));

  revalidatePath(`/biens/properties/${id}`);
  redirect(`/biens/properties/${id}`);
}

export async function deletePropertyAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');
  await db.delete(properties).where(eq(properties.id, id));
  revalidatePath('/biens');
  redirect('/biens');
}
