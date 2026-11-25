'use server';

import { requireAdmin } from '@/lib/auth/role';
import { db } from '@/db/client';
import {
  companyDocuments,
  supplierDocuments,
  customerDocuments,
  propertyDocuments,
  lotDocuments,
  marcheDocuments,
  locationDocuments,
  documentTypes,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { deleteObject } from '@/lib/storage/document-helpers';

/**
 * Édition d'un document existant : type, nom, date du document, date
 * d'expiration, notes. Le storage_key n'est PAS modifiable (verrouillé après
 * upload pour préserver la cohérence MinIO). Retours 24/11 pt 11 : le type est
 * modifiable, limité aux types du même scope (actifs, ou le type actuel).
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
  typeId: z.string().uuid(),
  name: z.string().min(1).max(255),
  documentDate: z.string().optional().or(z.literal('')),
  expiresAt: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  // V1.12 R1 — col legacy `category` retirée du doc. Catégorie héritée du type.
});

export async function updateDocumentAction(formData: FormData): Promise<void> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const { scope, id, parentId, typeId, name, documentDate, expiresAt, notes } = parsed.data;
  const table = TABLES[scope];

  // Retours 24/11 pt 11 — le type doit exister, appartenir au même scope et être
  // actif (sauf s'il est inchangé : un doc peut garder un type désactivé depuis).
  const [current] = await db
    .select({ typeId: table.typeId })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  if (!current) throw new Error('Document introuvable');
  const [type] = await db
    .select({
      scope: documentTypes.scope,
      isActive: documentTypes.isActive,
      hasExpiration: documentTypes.hasExpiration,
    })
    .from(documentTypes)
    .where(eq(documentTypes.id, typeId))
    .limit(1);
  if (!type || type.scope !== scope) throw new Error('Type de document invalide pour ce scope');
  if (!type.isActive && typeId !== current.typeId) throw new Error('Type de document désactivé');

  await db
    .update(table)
    .set({
      typeId,
      name,
      documentDate: documentDate || null,
      // Nouveau type sans échéance → on efface l'échéance (cohérent avec le
      // formulaire qui n'affiche le champ que pour les types avec échéance).
      expiresAt: type.hasExpiration ? expiresAt || null : null,
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
  await requireAdmin();
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

export type DocumentScope = Scope;
