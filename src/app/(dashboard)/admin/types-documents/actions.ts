'use server';

import { db } from '@/db/client';
import { documentTypes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const createSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'Code en minuscule, chiffres et underscores uniquement'),
  label: z.string().min(1).max(255),
  scope: z.enum(['supplier', 'customer', 'property', 'lot', 'marche', 'marche_lot', 'location']),
  hasExpiration: z.string().optional(),
});

export async function createDocumentTypeAction(formData: FormData): Promise<void> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  await db.insert(documentTypes).values({
    code: parsed.data.code,
    label: parsed.data.label,
    scope: parsed.data.scope,
    hasExpiration: parsed.data.hasExpiration === 'on',
    isActive: true,
    sortOrder: 100,
  });

  revalidatePath('/admin/types-documents');
}

export async function toggleActiveAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  const current = await db
    .select({ isActive: documentTypes.isActive })
    .from(documentTypes)
    .where(eq(documentTypes.id, id))
    .limit(1);
  if (current.length === 0) throw new Error('Type introuvable');

  await db
    .update(documentTypes)
    .set({ isActive: !current[0].isActive })
    .where(eq(documentTypes.id, id));

  revalidatePath('/admin/types-documents');
}
