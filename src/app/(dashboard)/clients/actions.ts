'use server';

import { db } from '@/db/client';
import { customers, customerDocuments, locations } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { fkPreflightSummary } from '@/lib/db/fk-check';
import { buildStoragePrefix } from '@/lib/storage/minio';
import { getDownloadUrl, deleteObject } from '@/lib/storage/document-helpers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const tenantTypePreprocess = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.enum(['LT', 'CT']).nullable()
);

const customerSchema = z.object({
  companyName: z.string().optional().or(z.literal('')),
  firstName: z.string().optional().or(z.literal('')),
  lastName: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  tenantType: tenantTypePreprocess.optional(),
});

const customerUpdateSchema = customerSchema.extend({
  id: z.string().uuid(),
  isActive: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
});

export async function updateCustomerAction(formData: FormData): Promise<void> {
  const parsed = customerUpdateSchema.safeParse({
    id: formData.get('id'),
    companyName: formData.get('companyName'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    address: formData.get('address'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    notes: formData.get('notes'),
    isActive: formData.get('isActive'),
    tenantType: formData.get('tenantType'),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;
  await db
    .update(customers)
    .set({
      companyName: data.companyName || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      notes: data.notes || null,
      isActive: data.isActive,
      tenantType: data.tenantType ?? null,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, data.id));
  revalidatePath('/clients');
  revalidatePath(`/clients/${data.id}`);
  redirect(`/clients/${data.id}`);
}

function safeReturnTo(value: unknown, fallback: string): string {
  const v = typeof value === 'string' ? value : '';
  if (!v.startsWith('/') || v.startsWith('//')) return fallback;
  return v;
}

export async function createCustomerAction(formData: FormData): Promise<void> {
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;
  const displayName =
    data.companyName || `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() || 'client';

  const inserted = await db
    .insert(customers)
    .values({
      companyName: data.companyName || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      notes: data.notes || null,
      tenantType: data.tenantType ?? null,
      storagePath: buildStoragePrefix('customers', displayName),
    })
    .returning({ id: customers.id });

  revalidatePath('/clients');
  revalidatePath('/locations');
  const fallback = `/clients/${inserted[0].id}`;
  redirect(safeReturnTo(formData.get('returnTo'), fallback));
}

/**
 * Création inline depuis un combobox (formulaire de location, marché, etc.).
 * Retourne l'id et le label pour sélection immédiate dans le combobox parent.
 * Pas de redirect — l'appelant fait son propre revalidate.
 */
export async function createCustomerInlineAction(formData: FormData): Promise<
  { id: string; label: string } | { error: string }
> {
  // Le dialog d'EntityCombobox ne contient que companyName/firstName/lastName/email/phone.
  // formData.get('address'/'notes') retournerait `null` → schema `z.string().optional().or(z.literal(''))`
  // rejetterait null en "Invalid input". Object.fromEntries omet les clés absentes
  // → schema voit `undefined` → `.optional()` accepte.
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(', ') };
  }
  const data = parsed.data;
  const displayName =
    data.companyName || `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim();
  if (!displayName) {
    return { error: 'Saisissez au moins une raison sociale ou un prénom/nom.' };
  }

  const inserted = await db
    .insert(customers)
    .values({
      companyName: data.companyName || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      notes: data.notes || null,
      storagePath: buildStoragePrefix('customers', displayName),
    })
    .returning({ id: customers.id });

  revalidatePath('/clients');
  return { id: inserted[0].id, label: displayName };
}

export async function deleteCustomerAction(
  formData: FormData
): Promise<void | { error: string }> {
  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'ID manquant' };

  // V1.12 R4 — pré-flight FK : compte locations liées + récupère 5 labels.
  // displayName via SQL : lot.id + date_debut pour distinguer si pas de nom propre.
  // V1.13 R2 — nom du client ajouté au message.
  const customerRow = await db
    .select({
      companyName: customers.companyName,
      firstName: customers.firstName,
      lastName: customers.lastName,
    })
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  const customerName =
    customerRow[0]?.companyName ||
    `${customerRow[0]?.firstName ?? ''} ${customerRow[0]?.lastName ?? ''}`.trim() ||
    'client inconnu';

  const locationsRows = await db
    .select({
      id: locations.id,
      displayName: sql<string>`COALESCE(${locations.dateDebut}::text, 'Sans date') || ' (' || ${locations.id}::text || ')'`,
    })
    .from(locations)
    .where(eq(locations.customerId, id));

  const summary = fkPreflightSummary(
    [{ label: 'locations', rows: locationsRows }],
    { kind: 'client', name: customerName },
  );
  if (summary) return { error: summary };

  try {
    await db.delete(customers).where(eq(customers.id, id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue';
    return { error: `Suppression impossible : ${msg}` };
  }

  revalidatePath('/clients');
  redirect('/clients');
}

export async function toggleCustomerActiveAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');
  const current = await db
    .select({ isActive: customers.isActive })
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  if (current.length === 0) throw new Error('Client introuvable');
  await db
    .update(customers)
    .set({ isActive: !current[0].isActive, updatedAt: new Date() })
    .where(eq(customers.id, id));
  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
}

const customerDocumentSchema = z.object({
  customerId: z.string().uuid(),
  typeId: z.string().uuid(),
  name: z.string().min(1).max(255),
  storageKey: z.string().min(1),
  documentDate: z.string().optional().or(z.literal('')),
  expiresAt: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  // V1.12 R1+R2 — col legacy `category` retirée. Catégorie héritée de document_types.
});

export async function uploadCustomerDocumentAction(formData: FormData): Promise<void> {
  const parsed = customerDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;
  await db.insert(customerDocuments).values({
    customerId: data.customerId,
    typeId: data.typeId,
    name: data.name,
    storageKey: data.storageKey,
    documentDate: data.documentDate || null,
    expiresAt: data.expiresAt || null,
    notes: data.notes || null,
  });
  revalidatePath(`/clients/${data.customerId}`);
}

export async function deleteCustomerDocumentAction(formData: FormData): Promise<void> {
  const documentId = String(formData.get('documentId') ?? '');
  const customerId = String(formData.get('customerId') ?? '');
  if (!documentId || !customerId) throw new Error('IDs manquants');

  const rows = await db
    .select({ storageKey: customerDocuments.storageKey })
    .from(customerDocuments)
    .where(eq(customerDocuments.id, documentId))
    .limit(1);

  if (rows[0]?.storageKey) {
    await deleteObject(rows[0].storageKey);
  }

  await db.delete(customerDocuments).where(eq(customerDocuments.id, documentId));
  revalidatePath(`/clients/${customerId}`);
}

export async function getCustomerDocumentUrlAction(
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
