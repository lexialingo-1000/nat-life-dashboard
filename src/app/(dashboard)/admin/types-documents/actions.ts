'use server';

import { requireAdmin } from '@/lib/auth/role';
import { db } from '@/db/client';
import { documentTypes, documentCategories } from '@/db/schema';
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
  z.enum(CATEGORY_VALUES).nullable(),
);

const checkboxToBool = z.preprocess((v) => v === 'on' || v === true, z.boolean());

// Retours 24/11 pt 12 — sélection multiple (cases à cocher). Aucune case = tous
// (stocké NULL). L'ancienne valeur 'all' n'existe plus : aucune case = tous.
const TENANT_TYPE_VALUES = ['LT', 'CT'] as const;

// dashboard-22 #8b — type de société (scope=company).
const COMPANY_TYPE_VALUES = [
  'commerciale_bilan',
  'commerciale_sans_bilan',
  'immobiliere_bilan',
  'immobiliere_sans_bilan',
] as const;

const tenantTypesSchema = z.array(z.enum(TENANT_TYPE_VALUES));
const companyTypesSchema = z.array(z.enum(COMPANY_TYPE_VALUES));
const supplierTypeIdsSchema = z.array(z.string().uuid());

// Object.fromEntries ne garde qu'une valeur par clé : les champs multiples sont
// relus via getAll (dédoublonnés, valeurs vides retirées).
function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = Object.fromEntries(formData);
  for (const key of ['supplierTypeIds', 'appliesToTenantTypes', 'appliesToCompanyTypes']) {
    obj[key] = Array.from(new Set(formData.getAll(key).map(String).filter(Boolean)));
  }
  return obj;
}

const emptyToNull = <T>(arr: T[]): T[] | null => (arr.length > 0 ? arr : null);

const uuidOrNull = z.preprocess(
  (v) => (v === '' || v == null || v === undefined ? null : v),
  z.string().uuid().nullable(),
);

const createSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'Code en minuscule, chiffres et underscores uniquement'),
  label: z.string().min(1).max(255),
  scope: z.enum(SCOPE_VALUES),
  // V12bis PR2 — categoryId FK remplace l'enum hardcodé (enum gardé en parallèle
  // pour compat documents-manager auto-prefill).
  categoryId: uuidOrNull.optional(),
  supplierTypeIds: supplierTypeIdsSchema,
  hasExpiration: checkboxToBool.optional(),
  isRequired: checkboxToBool.optional(),
  appliesToTenantTypes: tenantTypesSchema,
  appliesToCompanyTypes: companyTypesSchema,
});

const updateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(255),
  categoryId: uuidOrNull,
  supplierTypeIds: supplierTypeIdsSchema,
  hasExpiration: checkboxToBool,
  isRequired: checkboxToBool,
  appliesToTenantTypes: tenantTypesSchema,
  appliesToCompanyTypes: companyTypesSchema,
  sortOrder: z.preprocess((v) => Number(v ?? 0), z.number().int().min(0).max(9999)),
  isActive: checkboxToBool,
});

// Lookup categoryId → enum code (pour compat documents-manager auto-prefill).
// Si le code de la catégorie est dans l'enum legacy, on l'écrit aussi dans
// documentTypes.category. Sinon (ex: URBANISME), null.
async function resolveLegacyCategoryEnum(
  categoryId: string | null,
): Promise<(typeof CATEGORY_VALUES)[number] | null> {
  if (!categoryId) return null;
  const [row] = await db
    .select({ code: documentCategories.code })
    .from(documentCategories)
    .where(eq(documentCategories.id, categoryId))
    .limit(1);
  if (!row) return null;
  const legacy = CATEGORY_VALUES.find((v) => v === row.code);
  return legacy ?? null;
}

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
  formData: FormData,
): Promise<CreateDocumentTypeState> {
  await requireAdmin();
  const parsed = createSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  const {
    code,
    label,
    scope,
    categoryId,
    supplierTypeIds,
    hasExpiration,
    isRequired,
    appliesToTenantTypes,
    appliesToCompanyTypes,
  } = parsed.data;

  const finalAppliesTo = scope === 'customer' ? emptyToNull(appliesToTenantTypes) : null;
  const finalSupplierTypeIds = scope === 'supplier' ? emptyToNull(supplierTypeIds) : null;
  const finalCompanyTypes = scope === 'company' ? emptyToNull(appliesToCompanyTypes) : null;
  const legacyCategoryEnum = await resolveLegacyCategoryEnum(categoryId ?? null);

  try {
    await db.insert(documentTypes).values({
      code,
      label,
      scope,
      category: legacyCategoryEnum,
      categoryId: categoryId ?? null,
      supplierTypeIds: finalSupplierTypeIds,
      hasExpiration: hasExpiration ?? false,
      isRequired: isRequired ?? false,
      appliesToTenantTypes: finalAppliesTo,
      appliesToCompanyTypes: finalCompanyTypes,
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
  await requireAdmin();
  const parsed = updateSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const current = await db
    .select({ scope: documentTypes.scope })
    .from(documentTypes)
    .where(eq(documentTypes.id, parsed.data.id))
    .limit(1);
  if (current.length === 0) throw new Error('Type introuvable');

  const { scope } = current[0];
  const finalAppliesTo =
    scope === 'customer' ? emptyToNull(parsed.data.appliesToTenantTypes) : null;
  const finalSupplierTypeIds =
    scope === 'supplier' ? emptyToNull(parsed.data.supplierTypeIds) : null;
  const finalCompanyTypes =
    scope === 'company' ? emptyToNull(parsed.data.appliesToCompanyTypes) : null;
  const legacyCategoryEnum = await resolveLegacyCategoryEnum(parsed.data.categoryId);

  await db
    .update(documentTypes)
    .set({
      label: parsed.data.label,
      category: legacyCategoryEnum,
      categoryId: parsed.data.categoryId,
      supplierTypeIds: finalSupplierTypeIds,
      hasExpiration: parsed.data.hasExpiration,
      isRequired: parsed.data.isRequired,
      appliesToTenantTypes: finalAppliesTo,
      appliesToCompanyTypes: finalCompanyTypes,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(documentTypes.id, parsed.data.id));

  revalidatePath('/admin/types-documents');
  redirect('/admin/types-documents');
}

export async function reorderDocumentTypesAction(orderedIds: string[]): Promise<void> {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
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
        `Ce type est utilisé par un ou plusieurs documents existants. Désactive-le plutôt via le toggle "Type actif" (les documents historiques garderont leur référence).`,
      );
    }
    throw new Error(msg || 'Erreur lors de la suppression du type.');
  }

  revalidatePath('/admin/types-documents');
  redirect('/admin/types-documents');
}
