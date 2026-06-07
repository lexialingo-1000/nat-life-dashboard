'use server';

import { db } from '@/db/client';
import { supplierTypes, suppliers, documentTypes } from '@/db/schema';
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
    return `Un type de fournisseur avec le code "${code}" existe déjà.`;
  }
  return msg || 'Erreur inconnue lors de la création du type.';
}

export type CreateSupplierTypeState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; createdAt: number };

export async function createSupplierTypeAction(
  _prev: CreateSupplierTypeState,
  formData: FormData,
): Promise<CreateSupplierTypeState> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  try {
    await db.insert(supplierTypes).values({
      code: parsed.data.code,
      label: parsed.data.label,
      isActive: true,
      sortOrder: 1000,
    });
  } catch (e) {
    return { status: 'error', message: humanizeDbError(e, parsed.data.code) };
  }

  revalidatePath('/admin/supplier-types');
  revalidatePath('/admin/parametres');
  return { status: 'success', createdAt: Date.now() };
}

export async function updateSupplierTypeAction(formData: FormData): Promise<void> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  await db
    .update(supplierTypes)
    .set({
      label: parsed.data.label,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(supplierTypes.id, parsed.data.id));

  revalidatePath('/admin/supplier-types');
  redirect('/admin/supplier-types');
}

export async function reorderSupplierTypesAction(orderedIds: string[]): Promise<void> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(supplierTypes)
      .set({ sortOrder: (i + 1) * 10 })
      .where(eq(supplierTypes.id, orderedIds[i]));
  }
  revalidatePath('/admin/supplier-types');
}

export async function toggleSupplierTypeActiveAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  const current = await db
    .select({ isActive: supplierTypes.isActive })
    .from(supplierTypes)
    .where(eq(supplierTypes.id, id))
    .limit(1);
  if (current.length === 0) throw new Error('Type introuvable');

  await db
    .update(supplierTypes)
    .set({ isActive: !current[0].isActive })
    .where(eq(supplierTypes.id, id));

  revalidatePath('/admin/supplier-types');
}

export async function deleteSupplierTypeAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  const [suppliersCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(suppliers)
    .where(eq(suppliers.typeId, id));
  const [docTypesCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(documentTypes)
    .where(eq(documentTypes.supplierTypeId, id));

  const total = (suppliersCount?.n ?? 0) + (docTypesCount?.n ?? 0);
  if (total > 0) {
    throw new Error(
      `Type utilisé par ${suppliersCount?.n ?? 0} fournisseur(s) et ${docTypesCount?.n ?? 0} type(s) de document. Désactive-le plutôt (toggle "Type actif") pour préserver l'historique.`,
    );
  }

  await db.delete(supplierTypes).where(eq(supplierTypes.id, id));
  revalidatePath('/admin/supplier-types');
  redirect('/admin/supplier-types');
}
