'use server';

import { db } from '@/db/client';
import { suppliers, supplierContacts, supplierDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildStoragePrefix } from '@/lib/storage/minio';
import { getDownloadUrl, deleteObject } from '@/lib/storage/document-helpers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const supplierSchema = z.object({
  companyName: z.string().optional().or(z.literal('')),
  firstName: z.string().optional().or(z.literal('')),
  lastName: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  invoicingType: z
    .enum(['pennylane', 'email_forward', 'scraping_required', 'manual_upload'])
    .default('manual_upload'),
  notes: z.string().optional().or(z.literal('')),
});

const supplierUpdateSchema = supplierSchema.extend({
  id: z.string().uuid(),
  isActive: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
});

export async function updateSupplierAction(formData: FormData): Promise<void> {
  const parsed = supplierUpdateSchema.safeParse({
    id: formData.get('id'),
    companyName: formData.get('companyName'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    address: formData.get('address'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    invoicingType: formData.get('invoicingType') ?? 'manual_upload',
    notes: formData.get('notes'),
    isActive: formData.get('isActive'),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;
  await db
    .update(suppliers)
    .set({
      companyName: data.companyName || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      invoicingType: data.invoicingType,
      notes: data.notes || null,
      isActive: data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(suppliers.id, data.id));
  revalidatePath('/fournisseurs');
  revalidatePath(`/fournisseurs/${data.id}`);
  redirect(`/fournisseurs/${data.id}`);
}

export async function createSupplierAction(formData: FormData): Promise<void> {
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const data = parsed.data;
  const displayName =
    data.companyName || `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() || 'fournisseur';

  const inserted = await db
    .insert(suppliers)
    .values({
      ...data,
      companyName: data.companyName || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      notes: data.notes || null,
      storagePath: buildStoragePrefix('suppliers', displayName),
    })
    .returning({ id: suppliers.id });

  revalidatePath('/fournisseurs');
  redirect(`/fournisseurs/${inserted[0].id}`);
}

const contactSchema = z.object({
  supplierId: z.string().uuid(),
  firstName: z.string().optional().or(z.literal('')),
  lastName: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  function: z.string().optional().or(z.literal('')),
});

export async function deleteSupplierAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');
  await db.delete(suppliers).where(eq(suppliers.id, id));
  revalidatePath('/fournisseurs');
  redirect('/fournisseurs');
}

export async function toggleSupplierActiveAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID manquant');
  const current = await db
    .select({ isActive: suppliers.isActive })
    .from(suppliers)
    .where(eq(suppliers.id, id))
    .limit(1);
  if (current.length === 0) throw new Error('Fournisseur introuvable');
  await db
    .update(suppliers)
    .set({ isActive: !current[0].isActive, updatedAt: new Date() })
    .where(eq(suppliers.id, id));
  revalidatePath('/fournisseurs');
  revalidatePath(`/fournisseurs/${id}`);
}

export async function addContactAction(formData: FormData): Promise<void> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;
  await db.insert(supplierContacts).values({
    supplierId: data.supplierId,
    firstName: data.firstName || null,
    lastName: data.lastName || null,
    phone: data.phone || null,
    email: data.email || null,
    function: data.function || null,
  });
  revalidatePath(`/fournisseurs/${data.supplierId}`);
  revalidatePath('/fournisseurs');
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  const contactId = String(formData.get('contactId') ?? '');
  const supplierId = String(formData.get('supplierId') ?? '');
  if (!contactId || !supplierId) throw new Error('IDs manquants');
  await db.delete(supplierContacts).where(eq(supplierContacts.id, contactId));
  revalidatePath(`/fournisseurs/${supplierId}`);
  revalidatePath('/fournisseurs');
}

const supplierDocumentSchema = z.object({
  supplierId: z.string().uuid(),
  typeId: z.string().uuid(),
  name: z.string().min(1).max(255),
  storageKey: z.string().min(1),
  documentDate: z.string().optional().or(z.literal('')),
  expiresAt: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export async function uploadSupplierDocumentAction(formData: FormData): Promise<void> {
  const parsed = supplierDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(', '));
  }
  const data = parsed.data;
  await db.insert(supplierDocuments).values({
    supplierId: data.supplierId,
    typeId: data.typeId,
    name: data.name,
    storageKey: data.storageKey,
    documentDate: data.documentDate || null,
    expiresAt: data.expiresAt || null,
    notes: data.notes || null,
  });
  revalidatePath(`/fournisseurs/${data.supplierId}`);
  revalidatePath('/fournisseurs');
}

export async function deleteSupplierDocumentAction(formData: FormData): Promise<void> {
  const documentId = String(formData.get('documentId') ?? '');
  const supplierId = String(formData.get('supplierId') ?? '');
  if (!documentId || !supplierId) throw new Error('IDs manquants');

  const rows = await db
    .select({ storageKey: supplierDocuments.storageKey })
    .from(supplierDocuments)
    .where(eq(supplierDocuments.id, documentId))
    .limit(1);

  if (rows[0]?.storageKey) {
    await deleteObject(rows[0].storageKey);
  }

  await db.delete(supplierDocuments).where(eq(supplierDocuments.id, documentId));
  revalidatePath(`/fournisseurs/${supplierId}`);
  revalidatePath('/fournisseurs');
}

export async function getSupplierDocumentUrlAction(
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
