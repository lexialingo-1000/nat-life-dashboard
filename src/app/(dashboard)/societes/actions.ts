'use server';

import { db } from '@/db/client';
import { companies, companyDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { lookupBySiren, searchByName, normalizeSirenOrSiret } from '@/lib/recherche-entreprises';
import { getDownloadUrl, deleteObject } from '@/lib/storage/document-helpers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  siren: z
    .preprocess(
      (v) => {
        const s = typeof v === 'string' ? v.trim() : '';
        if (!s) return '';
        const normalized = normalizeSirenOrSiret(s);
        return normalized ?? s;
      },
      z
        .string()
        .regex(/^\d{9}$/, 'SIREN/SIRET invalide (9 ou 14 chiffres)')
        .optional()
        .or(z.literal(''))
    )
    .optional(),
  type: z.enum(['commerciale', 'immobiliere']),
  formeJuridique: z
    .enum(['sas', 'sarl', 'sci', 'indivision', 'eurl', 'sa', 'auto_entrepreneur', 'autre'])
    .optional(),
  address: z.string().optional().or(z.literal('')),
  activitePrincipale: z.string().optional().or(z.literal('')),
  nafCode: z.string().optional().or(z.literal('')),
});

export async function lookupSirenAction(formData: FormData) {
  const raw = String(formData.get('siren') ?? '').trim();
  const normalized = normalizeSirenOrSiret(raw);
  if (!normalized) {
    return { error: 'Saisissez un numéro SIREN (9 chiffres) ou SIRET (14 chiffres).' };
  }
  try {
    const result = await lookupBySiren(normalized);
    if (!result) return { error: 'Numéro non trouvé dans la base SIRENE' };
    return { data: result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur API' };
  }
}

export async function searchByNameAction(formData: FormData) {
  const query = String(formData.get('query') ?? '').trim();
  if (query.length < 2) {
    return { error: 'Saisis au moins 2 caractères' };
  }
  try {
    const results = await searchByName(query);
    if (results.length === 0) return { error: 'Aucune société trouvée' };
    return { data: results };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur API' };
  }
}

export async function deleteSocieteAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');
  await db.delete(companies).where(eq(companies.id, id));
  revalidatePath('/societes');
  redirect('/societes');
}

export async function createSocieteAction(formData: FormData) {
  const parsed = createSchema.safeParse({
    name: formData.get('name'),
    siren: formData.get('siren'),
    type: formData.get('type'),
    formeJuridique: formData.get('formeJuridique') || undefined,
    address: formData.get('address'),
    activitePrincipale: formData.get('activitePrincipale'),
    nafCode: formData.get('nafCode'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(', ') };
  }

  const { siren, address, activitePrincipale, nafCode, formeJuridique, ...rest } = parsed.data;

  await db.insert(companies).values({
    ...rest,
    siren: siren || null,
    formeJuridique: formeJuridique ?? null,
    address: address || null,
    activitePrincipale: activitePrincipale || null,
    nafCode: nafCode || null,
  });

  revalidatePath('/societes');
  redirect('/societes');
}

const updateSchema = createSchema.extend({
  id: z.string().uuid(),
  isActive: z.preprocess(
    (v) => v === 'on' || v === 'true' || v === true,
    z.boolean()
  ),
});

export async function updateSocieteAction(formData: FormData): Promise<void> {
  const parsed = updateSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    siren: formData.get('siren'),
    type: formData.get('type'),
    formeJuridique: formData.get('formeJuridique') || undefined,
    address: formData.get('address'),
    activitePrincipale: formData.get('activitePrincipale'),
    nafCode: formData.get('nafCode'),
    isActive: formData.get('isActive'),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const { id, siren, address, activitePrincipale, nafCode, formeJuridique, isActive, ...rest } =
    parsed.data;

  await db
    .update(companies)
    .set({
      ...rest,
      siren: siren || null,
      formeJuridique: formeJuridique ?? null,
      address: address || null,
      activitePrincipale: activitePrincipale || null,
      nafCode: nafCode || null,
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, id));

  revalidatePath('/societes');
  revalidatePath(`/societes/${id}`);
  redirect(`/societes/${id}`);
}

const companyDocumentSchema = z.object({
  companyId: z.string().uuid(),
  typeId: z.string().uuid(),
  name: z.string().min(1).max(255),
  storageKey: z.string().min(1),
  documentDate: z.string().optional().or(z.literal('')),
  expiresAt: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export async function uploadCompanyDocumentAction(formData: FormData): Promise<void> {
  const parsed = companyDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;
  await db.insert(companyDocuments).values({
    companyId: data.companyId,
    typeId: data.typeId,
    name: data.name,
    storageKey: data.storageKey,
    documentDate: data.documentDate || null,
    expiresAt: data.expiresAt || null,
    notes: data.notes || null,
  });
  revalidatePath(`/societes/${data.companyId}`);
}

export async function deleteCompanyDocumentAction(formData: FormData): Promise<void> {
  const documentId = String(formData.get('documentId') ?? '');
  const companyId = String(formData.get('companyId') ?? '');
  if (!documentId || !companyId) throw new Error('IDs manquants');

  const rows = await db
    .select({ storageKey: companyDocuments.storageKey })
    .from(companyDocuments)
    .where(eq(companyDocuments.id, documentId))
    .limit(1);

  if (rows[0]?.storageKey) {
    await deleteObject(rows[0].storageKey);
  }

  await db.delete(companyDocuments).where(eq(companyDocuments.id, documentId));
  revalidatePath(`/societes/${companyId}`);
}

export async function getCompanyDocumentUrlAction(
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  const storageKey = String(formData.get('storageKey') ?? '');
  if (!storageKey) return { error: 'Clé manquante' };
  try {
    const url = await getDownloadUrl(storageKey);
    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur MinIO' };
  }
}
