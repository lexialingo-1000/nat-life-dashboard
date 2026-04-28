import { db } from '@/db/client';
import {
  lots,
  properties,
  companies,
  levels,
  marchesTravaux,
  marcheLotAffectations,
  suppliers,
} from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';

const MARCHE_STATUS_LABELS: Record<string, string> = {
  devis_recu: 'Devis reçu',
  signe: 'Signé',
  en_cours: 'En cours',
  livre: 'Livré',
  conteste: 'Contesté',
  annule: 'Annulé',
};

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

  let lotMarches: any[] = [];
  if (lot) {
    lotMarches = await db
      .select({
        id: marchesTravaux.id,
        name: marchesTravaux.name,
        status: marchesTravaux.status,
        amountHt: marchesTravaux.amountHt,
        supplierName: suppliers.companyName,
      })
      .from(marcheLotAffectations)
      .innerJoin(marchesTravaux, eq(marchesTravaux.id, marcheLotAffectations.marcheId))
      .innerJoin(suppliers, eq(suppliers.id, marchesTravaux.supplierId))
      .where(eq(marcheLotAffectations.lotId, lot.id))
      .orderBy(asc(marchesTravaux.createdAt));
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

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{lot.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {lot.companyName} / {lot.propertyName} · {lot.type} ·{' '}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{lot.status}</span>
          </p>
        </div>
        <Link
          href={`/biens/lots/${lot.id}/edit`}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Pencil className="h-4 w-4" />
          Modifier
        </Link>
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
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Marchés de travaux affectés</h2>
          <Link
            href={`/biens/properties/${lot.propertyId}/marches/new`}
            className="text-xs text-amber-700 hover:underline"
          >
            + Nouveau marché (sur le bien)
          </Link>
        </div>
        {lotMarches.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun marché affecté à ce lot. La création se fait depuis la fiche du bien parent.
          </p>
        ) : (
          <ul className="space-y-2">
            {lotMarches.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-md border border-slate-100 p-3"
              >
                <div className="min-w-0 flex-1">
                  <Link href={`/marches/${m.id}`} className="text-sm font-medium hover:underline">
                    {m.name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {m.supplierName ?? '—'}
                    {m.amountHt &&
                      ` · ${Number(m.amountHt).toLocaleString('fr-FR')} € HT`}
                  </div>
                </div>
                <span className="badge-neutral">
                  {MARCHE_STATUS_LABELS[m.status] ?? m.status}
                </span>
              </li>
            ))}
          </ul>
        )}
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
