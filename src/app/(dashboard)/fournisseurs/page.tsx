import { db } from '@/db/client';
import { suppliers, supplierContacts } from '@/db/schema';
import { asc, sql, eq } from 'drizzle-orm';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { FournisseursTable, type FournisseurRow } from './fournisseurs-table';

export const dynamic = 'force-dynamic';

export default async function FournisseursPage() {
  let rows: FournisseurRow[] = [];
  let dbError: string | null = null;
  try {
    const raw = await db
      .select({
        id: suppliers.id,
        companyName: suppliers.companyName,
        firstName: suppliers.firstName,
        lastName: suppliers.lastName,
        email: suppliers.email,
        phone: suppliers.phone,
        invoicingType: suppliers.invoicingType,
        contactsCount: sql<number>`count(${supplierContacts.id})::int`,
      })
      .from(suppliers)
      .leftJoin(supplierContacts, eq(supplierContacts.supplierId, suppliers.id))
      .groupBy(suppliers.id)
      .orderBy(asc(suppliers.companyName));

    rows = raw.map((s) => ({
      id: s.id,
      displayName:
        s.companyName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() ?? '—',
      email: s.email,
      phone: s.phone,
      invoicingType: s.invoicingType,
      contactsCount: s.contactsCount,
    }));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fournisseurs</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Carnet d'adresses fournisseurs — multi-contacts + documents typés
          </p>
        </div>
        <Link href="/fournisseurs/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un fournisseur
        </Link>
      </div>

      {dbError && (
        <div className="card p-6 text-sm text-emerald-700">
          Connexion DB indisponible : {dbError}
        </div>
      )}

      {!dbError && (
        <div className="card overflow-hidden">
          <FournisseursTable rows={rows} />
        </div>
      )}
    </div>
  );
}
