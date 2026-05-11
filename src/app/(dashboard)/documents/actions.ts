'use server';

import { db } from '@/db/client';
import {
  companyDocuments,
  supplierDocuments,
  customerDocuments,
  propertyDocuments,
  lotDocuments,
  marcheDocuments,
  locationDocuments,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { deleteObject } from '@/lib/storage/document-helpers';

/**
 * Édition d'un document existant : nom, date du document, date d'expiration,
 * notes. Le type et le storage_key ne sont PAS modifiables (verrouillés après
 * upload pour préserver la cohérence des refs et MinIO).
 *
 * Action factorisée pour les 7 scopes — switch sur le scope pour cibler la
 * bonne table.
 *
 * V1.9 PR #3 L2 (V11 §14 : "Je veux modifier la date du document …").
 */

const SCOPES = [
  'company',
  'supplier',
  'customer',
  'property',
  'lot',
  'marche',
  'location',
] as const;
type Scope = (typeof SCOPES)[number];

const TABLES = {
  company: companyDocuments,
  supplier: supplierDocuments,
  customer: customerDocuments,
  property: propertyDocuments,
  lot: lotDocuments,
  marche: marcheDocuments,
  location: locationDocuments,
} as const;

const REVALIDATE_PATHS: Record<Scope, (parentId: string) => string[]> = {
  company: (id) => ['/societes', `/societes/${id}`],
  supplier: (id) => ['/fournisseurs', `/fournisseurs/${id}`],
  customer: (id) => ['/clients', `/clients/${id}`],
  property: (id) => ['/biens', `/biens/properties/${id}`],
  lot: (id) => ['/biens', `/biens/lots/${id}`],
  marche: (id) => ['/marches', `/marches/${id}`],
  location: (id) => ['/locations', `/locations/${id}`],
};

const BACK_PATHS: Record<Scope, (parentId: string) => string> = {
  company: (id) => `/societes/${id}`,
  supplier: (id) => `/fournisseurs/${id}`,
  customer: (id) => `/clients/${id}`,
  property: (id) => `/biens/properties/${id}`,
  lot: (id) => `/biens/lots/${id}`,
  marche: (id) => `/marches/${id}`,
  location: (id) => `/locations/${id}`,
};

const PARENT_FIELDS: Record<Scope, string> = {
  company: 'companyId',
  supplier: 'supplierId',
  customer: 'customerId',
  property: 'propertyId',
  lot: 'lotId',
  marche: 'marcheId',
  location: 'locationId',
};

const updateSchema = z.object({
  scope: z.enum(SCOPES),
  id: z.string().uuid(),
  parentId: z.string().uuid(),
  name: z.string().min(1).max(255),
  documentDate: z.string().optional().or(z.literal('')),
  expiresAt: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export async function updateDocumentAction(formData: FormData): Promise<void> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const { scope, id, parentId, name, documentDate, expiresAt, notes } = parsed.data;
  const table = TABLES[scope];

  await db
    .update(table)
    .set({
      name,
      documentDate: documentDate || null,
      expiresAt: expiresAt || null,
      notes: notes || null,
    })
    .where(eq(table.id, id));

  for (const p of REVALIDATE_PATHS[scope](parentId)) revalidatePath(p);
  redirect(BACK_PATHS[scope](parentId));
}

const deleteSchema = z.object({
  scope: z.enum(SCOPES),
  id: z.string().uuid(),
  parentId: z.string().uuid(),
});

export async function deleteDocumentByScopeAction(formData: FormData): Promise<void> {
  const parsed = deleteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const { scope, id, parentId } = parsed.data;
  const table = TABLES[scope];

  const rows = await db
    .select({ storageKey: table.storageKey })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);

  if (rows[0]?.storageKey) {
    try {
      await deleteObject(rows[0].storageKey);
    } catch {
      // MinIO peut être down ou la clé déjà inexistante — on supprime quand
      // même la ligne DB pour ne pas bloquer l'UI.
    }
  }

  await db.delete(table).where(eq(table.id, id));

  for (const p of REVALIDATE_PATHS[scope](parentId)) revalidatePath(p);
  redirect(BACK_PATHS[scope](parentId));
}

export const SUPPORTED_SCOPES = SCOPES;
export type DocumentScope = Scope;
export const PARENT_FIELD_BY_SCOPE = PARENT_FIELDS;
