import { db } from '@/db/client';
import { customers } from '@/db/schema';
import { asc } from 'drizzle-orm';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  let rows: any[] = [];
  let dbError: string | null = null;
  try {
    rows = await db.select().from(customers).orderBy(asc(customers.companyName));
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
            <span className="display-serif">Clients</span>
            <span className="ml-2 font-mono text-[13px] tnum text-zinc-400">{rows.length}</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] text-zinc-500">
            Table unifiée · clients FKA (B2B AMO) et locataires Valrose/KAPIMMO.
          </p>
        </div>
        <Link href="/clients/new" className="btn-primary">
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Ajouter un client
        </Link>
      </header>

      {dbError && (
        <div className="card p-6 text-sm text-emerald-700">
          Connexion DB indisponible : {dbError}
        </div>
      )}

      {!dbError && rows.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-sm text-zinc-500">Aucun client pour l'instant.</p>
          <Link href="/clients/new" className="btn-primary mt-4 inline-flex">
            <Plus className="mr-2 h-4 w-4" />
            Créer le premier client
          </Link>
        </div>
      )}

      {!dbError && rows.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Société / Nom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Adresse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/clients/${c.id}`} className="hover:underline">
                      {c.companyName ?? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{c.address ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
