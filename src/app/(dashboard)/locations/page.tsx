import { db } from '@/db/client';
import { locations, lots, properties, customers } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { LocationsTable, type LocationRow, type LocationStatus } from './locations-table';

export const dynamic = 'force-dynamic';

function computeStatus(dateDebut: string, dateFin: string | null): LocationStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const debut = new Date(dateDebut);
  if (dateFin) {
    const fin = new Date(dateFin);
    if (fin < today) return 'inactif';
  }
  if (debut > today) return 'a_venir';
  return 'actif';
}

export default async function LocationsListPage() {
  let rows: LocationRow[] = [];
  let dbError: string | null = null;
  try {
    const raw = await db
      .select({
        id: locations.id,
        typeLocation: locations.typeLocation,
        dateDebut: locations.dateDebut,
        dateFin: locations.dateFin,
        prixLocation: locations.prixLocation,
        periodicite: locations.periodicite,
        propertyId: properties.id,
        propertyName: properties.name,
        lotId: lots.id,
        lotName: lots.name,
        customerId: customers.id,
        customerCompanyName: customers.companyName,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
      })
      .from(locations)
      .innerJoin(lots, eq(lots.id, locations.lotId))
      .innerJoin(properties, eq(properties.id, lots.propertyId))
      .innerJoin(customers, eq(customers.id, locations.customerId))
      .orderBy(desc(locations.dateDebut));

    rows = raw.map((r) => {
      const customerLabel =
        r.customerCompanyName ||
        `${r.customerFirstName ?? ''} ${r.customerLastName ?? ''}`.trim() ||
        'locataire';
      return {
        id: r.id,
        propertyId: r.propertyId,
        propertyName: r.propertyName,
        lotId: r.lotId,
        lotName: r.lotName,
        customerId: r.customerId,
        customerLabel,
        typeLocation: r.typeLocation,
        dateDebut: r.dateDebut,
        dateFin: r.dateFin,
        status: computeStatus(r.dateDebut, r.dateFin),
        prixLocation: r.prixLocation,
        periodicite: r.periodicite,
      };
    });
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status] += 1;
      return acc;
    },
    { actif: 0, a_venir: 0, inactif: 0 } as Record<LocationStatus, number>
  );

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
            Patrimoine
          </div>
          <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">Locations</span>
            <span className="ml-2 font-mono text-[13px] tnum text-zinc-400">{rows.length}</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] text-zinc-500">
            {counts.actif} active{counts.actif > 1 ? 's' : ''} · {counts.a_venir} à venir ·{' '}
            {counts.inactif} terminée{counts.inactif > 1 ? 's' : ''}. Tri du plus récent au plus
            ancien.
          </p>
        </div>
        <Link href="/locations/new" className="btn-primary">
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Nouvelle location
        </Link>
      </header>

      {dbError && (
        <div className="card p-6 text-sm text-emerald-700">
          Connexion DB indisponible : {dbError}
        </div>
      )}

      {!dbError && (
        <div className="card overflow-hidden">
          <LocationsTable rows={rows} />
        </div>
      )}
    </div>
  );
}
