import { db } from '@/db/client';
import { suppliers, supplierContacts } from '@/db/schema';
import { asc, sql, eq } from 'drizzle-orm';
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
        isActive: suppliers.isActive,
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
      isActive: s.isActive,
    }));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
            Référentiel
          </div>
          <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">Fournisseurs</span>
            <span className="ml-2 font-mono text-[13px] tnum text-zinc-400">{rows.length}</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] text-zinc-500">
            Carnet d'adresses · multi-contacts et documents typés (RC, décennale, KBis).
          </p>
        </div>
        <a href="/fournisseurs/new" className="btn-primary">
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Ajouter un fournisseur
        </a>
      </header>

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
