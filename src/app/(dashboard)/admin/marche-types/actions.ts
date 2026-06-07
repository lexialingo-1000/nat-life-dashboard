'use server';

import { db } from '@/db/client';
import { marcheTypes, marchesTravaux, marcheSousLots } from '@/db/schema';
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
    return `Un type avec le code "${code}" existe déjà. Choisis un code différent ou réactive le type existant.`;
  }
  return msg || 'Erreur inconnue lors de la création du type.';
}

export type CreateMarcheTypeState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; createdAt: number };

export async function createMarcheTypeAction(
  _prev: CreateMarcheTypeState,
  formData: FormData,
): Promise<CreateMarcheTypeState> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  const { code, label } = parsed.data;

  try {
    await db.insert(marcheTypes).values({
      code,
      label,
      isActive: true,
      sortOrder: 1000,
    });
  } catch (e) {
    return { status: 'error', message: humanizeDbError(e, code) };
  }

  revalidatePath('/admin/marche-types');
  return { status: 'success', createdAt: Date.now() };
}

export async function updateMarcheTypeAction(formData: FormData): Promise<void> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  await db
    .update(marcheTypes)
    .set({
      label: parsed.data.label,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(marcheTypes.id, parsed.data.id));

  revalidatePath('/admin/marche-types');
  redirect('/admin/marche-types');
}

export async function reorderMarcheTypesAction(orderedIds: string[]): Promise<void> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(marcheTypes)
      .set({ sortOrder: (i + 1) * 10 })
      .where(eq(marcheTypes.id, orderedIds[i]));
  }
  revalidatePath('/admin/marche-types');
}

export async function toggleMarcheTypeActiveAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  const current = await db
    .select({ isActive: marcheTypes.isActive })
    .from(marcheTypes)
    .where(eq(marcheTypes.id, id))
    .limit(1);
  if (current.length === 0) throw new Error('Type introuvable');

  await db
    .update(marcheTypes)
    .set({ isActive: !current[0].isActive })
    .where(eq(marcheTypes.id, id));

  revalidatePath('/admin/marche-types');
}

export async function deleteMarcheTypeAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  // Compte les usages : marche_types est référencé par marches_travaux et
  // marche_sous_lots (les deux avec ON DELETE SET NULL → la suppression DB
  // est techniquement safe, mais on refuse si usage > 0 pour préserver le
  // contexte historique. La cliente peut désactiver le type via le toggle.
  const [marchesCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(marchesTravaux)
    .where(eq(marchesTravaux.marcheTypeId, id));
  const [sousLotsCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(marcheSousLots)
    .where(eq(marcheSousLots.marcheTypeId, id));

  const totalUsages = (marchesCount?.n ?? 0) + (sousLotsCount?.n ?? 0);
  if (totalUsages > 0) {
    throw new Error(
      `Type utilisé par ${marchesCount?.n ?? 0} marché(s) et ${sousLotsCount?.n ?? 0} sous-lot(s). Désactive-le plutôt (toggle "Type actif") pour préserver l'historique.`,
    );
  }

  await db.delete(marcheTypes).where(eq(marcheTypes.id, id));
  revalidatePath('/admin/marche-types');
  redirect('/admin/marche-types');
}
