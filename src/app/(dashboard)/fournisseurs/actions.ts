'use server';

import { db } from '@/db/client';
import { suppliers, supplierContacts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildStoragePrefix } from '@/lib/storage/minio';
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
}
