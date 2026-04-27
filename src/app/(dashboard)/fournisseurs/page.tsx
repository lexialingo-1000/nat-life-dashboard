import { db } from '@/db/client';
import { suppliers, supplierContacts } from '@/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function FournisseursPage() {
  let rows: any[] = [];
  let dbError: string | null = null;
  try {
    rows = await db
      .select({
        id: suppliers.id,
        companyName: suppliers.companyName,
        firstName: suppliers.firstName,
        lastName: suppliers.lastName,
        email: suppliers.email,
        phone: suppliers.phone,
        invoicingType: suppliers.invoicingType,
        contactsCount: sql<number>`(SELECT count(*)::int FROM ${supplierContacts} WHERE ${supplierContacts.supplierId} = ${suppliers.id})`,
      })
      .from(suppliers)
      .orderBy(asc(suppliers.companyName));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fournisseurs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Carnet d'adresses fournisseurs — multi-contacts + documents typés
          </p>
        </div>
        <Link href="/fournisseurs/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un fournisseur
        </Link>
      </div>

      {dbError && (
        <div className="card p-6 text-sm text-amber-700">
          Connexion DB indisponible : {dbError}
        </div>
      )}

      {!dbError && rows.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-sm text-slate-500">Aucun fournisseur pour l'instant.</p>
          <Link href="/fournisseurs/new" className="btn-primary mt-4 inline-flex">
            <Plus className="mr-2 h-4 w-4" />
            Créer le premier fournisseur
          </Link>
        </div>
      )}

      {!dbError && rows.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Société / Nom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Contacts</th>
                <th className="px-4 py-3">Facturation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/fournisseurs/${s.id}`} className="hover:underline">
                      {s.companyName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{s.contactsCount}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.invoicingType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
