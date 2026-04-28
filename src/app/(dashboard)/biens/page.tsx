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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Biens immobiliers</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Vue plate au niveau lot · {rows.length} lot{rows.length > 1 ? 's' : ''} · tri et
            filtre par colonne
          </p>
        </div>
        <Link href="/biens/properties/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un immeuble
        </Link>
      </div>

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
