'use server';

import { db } from '@/db/client';
import { documentCategories, documentTypes } from '@/db/schema';
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
    return `Une catégorie avec le code "${code}" existe déjà.`;
  }
  return msg || 'Erreur inconnue lors de la création de la catégorie.';
}

export type CreateDocumentCategoryState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; createdAt: number };

export async function createDocumentCategoryAction(
  _prev: CreateDocumentCategoryState,
  formData: FormData
): Promise<CreateDocumentCategoryState> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.errors.map((e) => e.message).join(', ') };
  }

  try {
    await db.insert(documentCategories).values({
      code: parsed.data.code,
      label: parsed.data.label,
      isActive: true,
      sortOrder: 1000,
    });
  } catch (e) {
    return { status: 'error', message: humanizeDbError(e, parsed.data.code) };
  }

  revalidatePath('/admin/document-categories');
  revalidatePath('/admin/parametres');
  return { status: 'success', createdAt: Date.now() };
}

export async function updateDocumentCategoryAction(formData: FormData): Promise<void> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  await db
    .update(documentCategories)
    .set({
      label: parsed.data.label,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(documentCategories.id, parsed.data.id));

  revalidatePath('/admin/document-categories');
  redirect('/admin/document-categories');
}

export async function reorderDocumentCategoriesAction(orderedIds: string[]): Promise<void> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(documentCategories)
      .set({ sortOrder: (i + 1) * 10 })
      .where(eq(documentCategories.id, orderedIds[i]));
  }
  revalidatePath('/admin/document-categories');
}

export async function toggleDocumentCategoryActiveAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  const current = await db
    .select({ isActive: documentCategories.isActive })
    .from(documentCategories)
    .where(eq(documentCategories.id, id))
    .limit(1);
  if (current.length === 0) throw new Error('Catégorie introuvable');

  await db
    .update(documentCategories)
    .set({ isActive: !current[0].isActive })
    .where(eq(documentCategories.id, id));

  revalidatePath('/admin/document-categories');
}

export async function deleteDocumentCategoryAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  const [docTypesCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(documentTypes)
    .where(eq(documentTypes.categoryId, id));

  if ((docTypesCount?.n ?? 0) > 0) {
    throw new Error(
      `Catégorie utilisée par ${docTypesCount.n} type(s) de document. Désactive-la plutôt (toggle "Catégorie active") pour préserver l'historique.`
    );
  }

  await db.delete(documentCategories).where(eq(documentCategories.id, id));
  revalidatePath('/admin/document-categories');
  redirect('/admin/document-categories');
}
