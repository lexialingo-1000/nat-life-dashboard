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
  hasExpiration: checkboxToBool.optional(),
  isRequired: checkboxToBool.optional(),
  appliesToTenantType: tenantPreprocess.optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(255),
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

  const { code, label, scope, hasExpiration, isRequired, appliesToTenantType } = parsed.data;

  const finalAppliesTo = scope === 'customer' ? appliesToTenantType ?? null : null;

  try {
    await db.insert(documentTypes).values({
      code,
      label,
      scope,
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
