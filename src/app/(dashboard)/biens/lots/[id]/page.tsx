import { db } from '@/db/client';
import { lots, properties, companies, levels, rooms } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function LotDetailPage({ params }: { params: { id: string } }) {
  let lot: any = null;
  let lotLevels: any[] = [];
  let dbError: string | null = null;
  try {
    const rows = await db
      .select({
        id: lots.id,
        name: lots.name,
        type: lots.type,
        surfaceCarrez: lots.surfaceCarrez,
        status: lots.status,
        notes: lots.notes,
        propertyId: properties.id,
        propertyName: properties.name,
        companyId: companies.id,
        companyName: companies.name,
      })
      .from(lots)
      .innerJoin(properties, eq(lots.propertyId, properties.id))
      .innerJoin(companies, eq(properties.companyId, companies.id))
      .where(eq(lots.id, params.id))
      .limit(1);
    if (rows.length === 0) notFound();
    lot = rows[0];

    lotLevels = await db
      .select()
      .from(levels)
      .where(eq(levels.lotId, lot.id))
      .orderBy(asc(levels.sortOrder));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  if (!lot) {
    return (
      <div className="card p-6 text-sm text-amber-700">
        Connexion DB indisponible : {dbError}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/biens/properties/${lot.propertyId}`}
        className="inline-flex items-center text-sm text-slate-600 hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {lot.propertyName}
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{lot.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {lot.companyName} / {lot.propertyName} · {lot.type} ·{' '}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{lot.status}</span>
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold">Informations</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs uppercase text-slate-500">Surface Carrez</dt>
            <dd className="mt-1 tabular-nums">
              {lot.surfaceCarrez ? `${lot.surfaceCarrez} m²` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Type</dt>
            <dd className="mt-1">{lot.type}</dd>
          </div>
          {lot.notes && (
            <div className="col-span-2">
              <dt className="text-xs uppercase text-slate-500">Notes</dt>
              <dd className="mt-1 whitespace-pre-wrap">{lot.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold">Niveaux & pièces</h2>
        {lotLevels.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Aucun niveau pour l'instant. UI d'édition à venir en V1 (Lot 3).
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {lotLevels.map((lv) => (
              <li key={lv.id} className="rounded-md border border-slate-100 p-3 text-sm">
                {lv.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold">Marchés de travaux</h2>
        <p className="mt-2 text-sm text-slate-500">
          Liste des marchés associés à ce lot. UI complète à venir (création depuis cette fiche, sous-lots techniques, documents catégorisés).
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold">Documents</h2>
        <p className="mt-2 text-sm text-slate-500">
          Diagnostics, photos, etc. À brancher sur MinIO une fois les credentials fournis.
        </p>
      </div>
    </div>
  );
}
