import { db } from '@/db/client';
import {
  marchesTravaux,
  marcheLotAffectations,
  lots,
  properties,
  companies,
  suppliers,
} from '@/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MarchesPage() {
  let rows: any[] = [];
  let dbError: string | null = null;
  try {
    rows = await db
      .select({
        id: marchesTravaux.id,
        name: marchesTravaux.name,
        amountHt: marchesTravaux.amountHt,
        status: marchesTravaux.status,
        dateDebutPrevu: marchesTravaux.dateDebutPrevu,
        dateFinPrevu: marchesTravaux.dateFinPrevu,
        propertyId: properties.id,
        propertyName: properties.name,
        companyName: companies.name,
        supplierName: suppliers.companyName,
        lotsConcernes: sql<string | null>`(
          SELECT string_agg(${lots.name}, ', ' ORDER BY ${lots.name})
          FROM ${marcheLotAffectations}
          INNER JOIN ${lots} ON ${lots.id} = ${marcheLotAffectations.lotId}
          WHERE ${marcheLotAffectations.marcheId} = ${marchesTravaux.id}
        )`,
      })
      .from(marchesTravaux)
      .innerJoin(properties, eq(marchesTravaux.propertyId, properties.id))
      .innerJoin(companies, eq(properties.companyId, companies.id))
      .innerJoin(suppliers, eq(marchesTravaux.supplierId, suppliers.id))
      .orderBy(asc(marchesTravaux.createdAt));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  return (
    <div className="space-y-8">
      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Patrimoine
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Marchés de travaux</span>
          <span className="ml-2 font-mono text-[13px] tnum text-zinc-400">{rows.length}</span>
        </h1>
        <p className="mt-1.5 max-w-xl text-[13px] text-zinc-500">
          Vue transversale des contrats fournisseur ↔ bien (et lots concernés).
        </p>
      </header>

      {dbError && (
        <div className="card p-6 text-sm text-emerald-700">
          Connexion DB indisponible : {dbError}
        </div>
      )}

      {!dbError && rows.length === 0 && (
        <div className="card p-12 text-center text-sm text-zinc-500">
          Aucun marché pour l'instant. La création de marchés se fait depuis la fiche d'un{' '}
          <Link href="/biens" className="text-blue-600 hover:underline">bien</Link>.
        </div>
      )}

      {!dbError && rows.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Marché</th>
                <th className="px-4 py-3">Société</th>
                <th className="px-4 py-3">Bien</th>
                <th className="px-4 py-3">Lots concernés</th>
                <th className="px-4 py-3">Fournisseur</th>
                <th className="px-4 py-3">Montant HT</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/marches/${m.id}`}
                      className="link-cell whitespace-nowrap font-medium uppercase tracking-[0.04em]"
                    >
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">{m.companyName}</td>
                  <td className="px-4 py-3 text-xs">
                    <Link
                      href={`/biens/properties/${m.propertyId}`}
                      className="link-cell-soft"
                    >
                      {m.propertyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {m.lotsConcernes ?? <span className="text-zinc-400">parties communes</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">{m.supplierName ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {m.amountHt ? `${Number(m.amountHt).toLocaleString('fr-FR')} €` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
