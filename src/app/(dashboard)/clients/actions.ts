'use server';

import { db } from '@/db/client';
import { customers, customerDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildStoragePrefix } from '@/lib/storage/minio';
import { getDownloadUrl, deleteObject } from '@/lib/storage/document-helpers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const customerSchema = z.object({
  companyName: z.string().optional().or(z.literal('')),
  firstName: z.string().optional().or(z.literal('')),
  lastName: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

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
      storagePath: buildStoragePrefix('customers', displayName),
    })
    .returning({ id: customers.id });

  revalidatePath('/clients');
  redirect(`/clients/${inserted[0].id}`);
}

const customerDocumentSchema = z.object({
  customerId: z.string().uuid(),
  typeId: z.string().uuid(),
  name: z.string().min(1).max(255),
  storageKey: z.string().min(1),
  documentDate: z.string().optional().or(z.literal('')),
  expiresAt: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
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
