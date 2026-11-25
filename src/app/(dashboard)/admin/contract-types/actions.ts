'use server';

// Retours 24/11/2026 pt 7 — types de contrat d'un lot paramétrables (copie du modèle location-types).

import { requireAdmin } from '@/lib/auth/role';
import { db } from '@/db/client';
import { contractTypes, lotContracts } from '@/db/schema';
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
    return `Un type de contrat avec le code "${code}" existe déjà.`;
  }
  return msg || 'Erreur inconnue lors de la création du type.';
}

export type CreateContractTypeState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; createdAt: number };

export async function createContractTypeAction(
  _prev: CreateContractTypeState,
  formData: FormData,
): Promise<CreateContractTypeState> {
  await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  try {
    await db.insert(contractTypes).values({
      code: parsed.data.code,
      label: parsed.data.label,
      isActive: true,
      sortOrder: 1000,
    });
  } catch (e) {
    return { status: 'error', message: humanizeDbError(e, parsed.data.code) };
  }

  revalidatePath('/admin/contract-types');
  revalidatePath('/admin/parametres');
  return { status: 'success', createdAt: Date.now() };
}

export async function updateContractTypeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  await db
    .update(contractTypes)
    .set({
      label: parsed.data.label,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(contractTypes.id, parsed.data.id));

  revalidatePath('/admin/contract-types');
  redirect('/admin/contract-types');
}

export async function reorderContractTypesAction(orderedIds: string[]): Promise<void> {
  await requireAdmin();
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(contractTypes)
      .set({ sortOrder: (i + 1) * 10 })
      .where(eq(contractTypes.id, orderedIds[i]));
  }
  revalidatePath('/admin/contract-types');
}

export async function toggleContractTypeActiveAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  const current = await db
    .select({ isActive: contractTypes.isActive })
    .from(contractTypes)
    .where(eq(contractTypes.id, id))
    .limit(1);
  if (current.length === 0) throw new Error('Type introuvable');

  await db
    .update(contractTypes)
    .set({ isActive: !current[0].isActive })
    .where(eq(contractTypes.id, id));

  revalidatePath('/admin/contract-types');
}

export async function deleteContractTypeAction(
  formData: FormData,
): Promise<void | { error: string }> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'ID manquant' };

  const [usage] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(lotContracts)
    .where(eq(lotContracts.typeId, id));

  // Renvoyé (pas levé) : en prod Next masque le message d'une erreur levée.
  if ((usage?.n ?? 0) > 0) {
    return {
      error: `Type utilisé par ${usage?.n ?? 0} contrat(s). Désactive-le plutôt (toggle "Type actif") pour préserver l'historique.`,
    };
  }

  await db.delete(contractTypes).where(eq(contractTypes.id, id));
  revalidatePath('/admin/contract-types');
  redirect('/admin/contract-types');
}
