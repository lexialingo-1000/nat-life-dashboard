'use server';

import { db } from '@/db/client';
import { companies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { lookupBySiren, searchByName } from '@/lib/recherche-entreprises';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  siren: z.string().regex(/^\d{9}$/).optional().or(z.literal('')),
  type: z.enum(['commerciale', 'immobiliere']),
  formeJuridique: z
    .enum(['sas', 'sarl', 'sci', 'indivision', 'eurl', 'sa', 'auto_entrepreneur', 'autre'])
    .optional(),
  address: z.string().optional().or(z.literal('')),
  activitePrincipale: z.string().optional().or(z.literal('')),
  nafCode: z.string().optional().or(z.literal('')),
});

export async function lookupSirenAction(formData: FormData) {
  const siren = String(formData.get('siren') ?? '').trim();
  if (!/^\d{9}$/.test(siren)) {
    return { error: 'SIREN invalide (9 chiffres requis)' };
  }
  try {
    const result = await lookupBySiren(siren);
    if (!result) return { error: 'SIREN non trouvé dans la base SIRENE' };
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
