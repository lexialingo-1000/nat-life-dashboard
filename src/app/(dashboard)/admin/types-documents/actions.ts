'use server';

import { db } from '@/db/client';
import { documentTypes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const SCOPE_VALUES = [
  'company',
  'supplier',
  'customer',
  'property',
  'lot',
  'marche',
  'marche_lot',
  'location',
] as const;

const CATEGORY_VALUES = [
  'notaire',
  'banque',
  'juridique',
  'comptabilite',
  'courant',
  'location',
] as const;

const categoryPreprocess = z.preprocess(
  (v) => (v === '' || v == null || v === undefined ? null : v),
  z.enum(CATEGORY_VALUES).nullable()
);

const checkboxToBool = z.preprocess(
  (v) => v === 'on' || v === true,
  z.boolean()
);

const tenantPreprocess = z.preprocess(
  (v) => (v === '' || v == null || v === undefined ? null : v),
  z.enum(['LT', 'CT', 'all']).nullable()
);

const createSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'Code en minuscule, chiffres et underscores uniquement'),
  label: z.string().min(1).max(255),
  scope: z.enum(SCOPE_VALUES),
  category: categoryPreprocess.optional(),
  hasExpiration: checkboxToBool.optional(),
  isRequired: checkboxToBool.optional(),
  appliesToTenantType: tenantPreprocess.optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(255),
  category: categoryPreprocess,
  hasExpiration: checkboxToBool,
  isRequired: checkboxToBool,
  appliesToTenantType: tenantPreprocess,
  sortOrder: z.preprocess((v) => Number(v ?? 0), z.number().int().min(0).max(9999)),
  isActive: checkboxToBool,
});

function humanizeDbError(e: unknown, code: string, scope: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  if ((e as { code?: string })?.code === '23505' || /unique/i.test(msg)) {
    return `Un type avec le code "${code}" existe déjà pour le scope "${scope}". Choisis un code différent ou réactive le type existant.`;
  }
  return msg || 'Erreur inconnue lors de la création du type.';
}

export type CreateDocumentTypeState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; createdAt: number };

export async function createDocumentTypeAction(
  _prev: CreateDocumentTypeState,
  formData: FormData
): Promise<CreateDocumentTypeState> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  const { code, label, scope, category, hasExpiration, isRequired, appliesToTenantType } = parsed.data;

  const finalAppliesTo = scope === 'customer' ? appliesToTenantType ?? null : null;

  try {
    await db.insert(documentTypes).values({
      code,
      label,
      scope,
      category: category ?? null,
      hasExpiration: hasExpiration ?? false,
      isRequired: isRequired ?? false,
      appliesToTenantType: finalAppliesTo,
      isActive: true,
      sortOrder: 100,
    });
  } catch (e) {
    return { status: 'error', message: humanizeDbError(e, code, scope) };
  }

  revalidatePath('/admin/types-documents');
  return { status: 'success', createdAt: Date.now() };
}

export async function updateDocumentTypeAction(formData: FormData): Promise<void> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const current = await db
    .select({ scope: documentTypes.scope })
    .from(documentTypes)
    .where(eq(documentTypes.id, parsed.data.id))
    .limit(1);
  if (current.length === 0) throw new Error('Type introuvable');

  const finalAppliesTo =
    current[0].scope === 'customer' ? parsed.data.appliesToTenantType : null;

  await db
    .update(documentTypes)
    .set({
      label: parsed.data.label,
      category: parsed.data.category,
      hasExpiration: parsed.data.hasExpiration,
      isRequired: parsed.data.isRequired,
      appliesToTenantType: finalAppliesTo,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(documentTypes.id, parsed.data.id));

  revalidatePath('/admin/types-documents');
  redirect('/admin/types-documents');
}

export async function reorderDocumentTypesAction(orderedIds: string[]): Promise<void> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(documentTypes)
      .set({ sortOrder: (i + 1) * 10 })
      .where(eq(documentTypes.id, orderedIds[i]));
  }
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

export async function deleteDocumentTypeAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');

  // Les 7 tables de docs (company/supplier/customer/property/lot/marche/location)
  // référencent documentTypes avec onDelete: 'restrict'. Si au moins un doc utilise
  // ce type, la suppression DB fail avec code 23503 → on traduit le message pour
  // suggérer la désactivation.
  try {
    await db.delete(documentTypes).where(eq(documentTypes.id, id));
  } catch (e) {
    const code = (e as { code?: string })?.code;
    const msg = e instanceof Error ? e.message : String(e);
    if (code === '23503' || /foreign key|violates/i.test(msg)) {
      throw new Error(
        `Ce type est utilisé par un ou plusieurs documents existants. Désactive-le plutôt via le toggle "Type actif" (les documents historiques garderont leur référence).`
      );
    }
    throw new Error(msg || 'Erreur lors de la suppression du type.');
  }

  revalidatePath('/admin/types-documents');
  redirect('/admin/types-documents');
}
