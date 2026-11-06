import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';

const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true';

export type Role = 'admin' | 'gestionnaire';

/** Rôle du compte connecté (table `users`, même id que Supabase Auth).
 *  null = pas connecté ou compte absent de `users` : traité comme non-admin. */
export const getCurrentRole = cache(async (): Promise<Role | null> => {
  if (DEV_BYPASS) return 'admin';
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return null;
  const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, user.id));
  return row?.role ?? null;
});

/** À appeler en tête de toute action réservée aux admins (Paramètres, suppressions).
 *  Une server action est appelable directement en POST : masquer le bouton ne suffit pas.
 *  Contrôle : tests/check-admin-guards.mjs. */
export async function requireAdmin() {
  if ((await getCurrentRole()) !== 'admin') {
    throw new Error('Action réservée aux administrateurs.');
  }
}
