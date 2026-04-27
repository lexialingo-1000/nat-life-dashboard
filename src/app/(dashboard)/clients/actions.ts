'use server';

import { db } from '@/db/client';
import { customers } from '@/db/schema';
import { buildStoragePrefix } from '@/lib/storage/minio';
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
