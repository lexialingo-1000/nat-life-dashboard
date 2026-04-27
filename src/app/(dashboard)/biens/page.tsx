import { db } from '@/db/client';
import { properties, lots, companies } from '@/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BiensPage() {
  let rows: any[] = [];
  let dbError: string | null = null;
  try {
    rows = await db
      .select({
        propertyId: properties.id,
        propertyName: properties.name,
        propertyType: properties.type,
        propertyAddress: properties.address,
        companyName: companies.name,
        lotsCount: sql<number>`(SELECT count(*)::int FROM "lots" WHERE "lots"."property_id" = "properties"."id")`,
      })
      .from(properties)
      .innerJoin(companies, eq(properties.companyId, companies.id))
      .orderBy(asc(companies.name), asc(properties.name));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  const grouped = rows.reduce<Record<string, any[]>>((acc, p) => {
    if (!acc[p.companyName]) acc[p.companyName] = [];
    acc[p.companyName].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Biens immobiliers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hiérarchie Société → Property (immeuble) → Lot (unité)
          </p>
        </div>
        <Link href="/biens/properties/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un immeuble
        </Link>
      </div>

      {dbError && (
        <div className="card p-6 text-sm text-amber-700">
          Connexion DB indisponible : {dbError}
        </div>
      )}

      {!dbError && rows.length === 0 && (
        <div className="card p-12 text-center text-sm text-slate-500">
          Aucun bien pour l'instant. Les seeds du Lot 0 ajoutent les 5 properties Valrose.
        </div>
      )}

      {!dbError &&
        Object.entries(grouped).map(([companyName, props]) => (
          <div key={companyName} className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold">{companyName}</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2">Nom</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Adresse</th>
                  <th className="px-4 py-2">Lots</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {props.map((p) => (
                  <tr key={p.propertyId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/biens/properties/${p.propertyId}`} className="hover:underline">
                        {p.propertyName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.propertyType}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{p.propertyAddress ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{p.lotsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
