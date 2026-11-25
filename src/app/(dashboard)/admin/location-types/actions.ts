'use server';

// Retours 24/11/2026 pt 6 — types de location paramétrables (copie du modèle supplier-types).

import { requireAdmin } from '@/lib/auth/role';
import { db } from '@/db/client';
import { locationTypes, locations } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const checkboxToBool = z.preprocess((v) => v === 'on' || v === true, z.boolean());

const createSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'Code en minuscule, chiffres et underscores uniquement'),
  label: z.string().min(1).max(255),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(255),
  sortOrder: z.preprocess((v) => Number(v ?? 0), z.number().int().min(0).max(9999)),
  isActive: checkboxToBool,
});

function humanizeDbError(e: unknown, code: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  if ((e as { code?: string })?.code === '23505' || /unique/i.test(msg)) {
    return `Un type de location avec le code "${code}" existe déjà.`;
  }
  return msg || 'Erreur inconnue lors de la création du type.';
}

export type CreateLocationTypeState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; createdAt: number };

export async function createLocationTypeAction(
  _prev: CreateLocationTypeState,
  formData: FormData,
): Promise<CreateLocationTypeState> {
  await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  try {
    await db.insert(locationTypes).values({
      code: parsed.data.code,
      label: parsed.data.label,
      isActive: true,
      sortOrder: 1000,
    });
  } catch (e) {
    return { status: 'error', message: humanizeDbError(e, parsed.data.code) };
  }

  revalidatePath('/admin/location-types');
  revalidatePath('/admin/parametres');
  return { status: 'success', createdAt: Date.now() };
}

export async function updateLocationTypeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  await db
    .update(locationTypes)
    .set({
      label: parsed.data.label,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(locationTypes.id, parsed.data.id));

  revalidatePath('/admin/location-types');
  redirect('/admin/location-types');
}

export async function reorderLocationTypesAction(orderedIds: string[]): Promise<void> {
  await requireAdmin();
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(locationTypes)
      .set({ sortOrder: (i + 1) * 10 })
      .where(eq(locationTypes.id, orderedIds[i]));
  }
  revalidatePath('/admin/location-types');
}

export async function toggleLocationTypeActiveAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  const current = await db
    .select({ isActive: locationTypes.isActive })
    .from(locationTypes)
    .where(eq(locationTypes.id, id))
    .limit(1);
  if (current.length === 0) throw new Error('Type introuvable');

  await db
    .update(locationTypes)
    .set({ isActive: !current[0].isActive })
    .where(eq(locationTypes.id, id));

  revalidatePath('/admin/location-types');
}

export async function deleteLocationTypeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  const [usage] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(locations)
    .where(eq(locations.typeId, id));

  if ((usage?.n ?? 0) > 0) {
    throw new Error(
      `Type utilisé par ${usage?.n ?? 0} location(s). Désactive-le plutôt (toggle "Type actif") pour préserver l'historique.`,
    );
  }

  await db.delete(locationTypes).where(eq(locationTypes.id, id));
  revalidatePath('/admin/location-types');
  redirect('/admin/location-types');
}
