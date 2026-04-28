import { db } from '@/db/client';
import { properties, lots, companies } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { BiensTable, type BienLotRow } from './biens-table';

export const dynamic = 'force-dynamic';

export default async function BiensPage() {
  let rows: BienLotRow[] = [];
  let dbError: string | null = null;
  try {
    const raw = await db
      .select({
        lotId: lots.id,
        lotName: lots.name,
        lotType: lots.type,
        lotStatus: lots.status,
        surfaceCarrez: lots.surfaceCarrez,
        propertyId: properties.id,
        propertyName: properties.name,
        companyId: companies.id,
        companyName: companies.name,
      })
      .from(lots)
      .innerJoin(properties, eq(lots.propertyId, properties.id))
      .innerJoin(companies, eq(properties.companyId, companies.id))
      .orderBy(asc(companies.name), asc(properties.name), asc(lots.name));

    rows = raw.map((r) => ({
      lotId: r.lotId,
      lotName: r.lotName,
      lotType: r.lotType,
      lotStatus: r.lotStatus,
      surfaceCarrez: r.surfaceCarrez,
      propertyId: r.propertyId,
      propertyName: r.propertyName,
      companyId: r.companyId,
      companyName: r.companyName,
    }));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
            Patrimoine
          </div>
          <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">Biens immobiliers</span>
            <span className="ml-2 font-mono text-[13px] tnum text-zinc-400">{rows.length}</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] text-zinc-500">
            Vue plate au niveau lot · tri et filtre par colonne.
          </p>
        </div>
        <Link href="/biens/properties/new" className="btn-primary">
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Ajouter un immeuble
        </Link>
      </header>

      {dbError && (
        <div className="card p-6 text-sm text-emerald-700">
          Connexion DB indisponible : {dbError}
        </div>
      )}

      {!dbError && (
        <div className="card overflow-hidden">
          <BiensTable rows={rows} />
        </div>
      )}
    </div>
  );
}
