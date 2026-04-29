import { db } from '@/db/client';
import {
  lots,
  properties,
  companies,
  levels,
  rooms,
  marchesTravaux,
  marcheLotAffectations,
  suppliers,
  locations,
  customers,
} from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { Tabs, type TabItem } from '@/components/tabs';
import { LevelsRoomsManager, type LevelWithRooms } from '@/components/levels-rooms-manager';
import { deleteLocationAction } from '@/app/(dashboard)/locations/actions';
import { formatDate } from '@/lib/utils';

const MARCHE_STATUS_LABELS: Record<string, string> = {
  devis_recu: 'Devis reçu',
  signe: 'Signé',
  en_cours: 'En cours',
  livre: 'Livré',
  conteste: 'Contesté',
  annule: 'Annulé',
};

const LOT_STATUS_LABELS: Record<string, string> = {
  vacant: 'Vacant',
  loue_annuel: 'Loué annuel',
  loue_saisonnier: 'Loué saisonnier',
  travaux: 'Travaux',
};

const LOCATION_TYPE_LABELS: Record<string, string> = {
  bail_meuble_annuel: 'Bail meublé annuel',
  bail_nu_annuel: 'Bail nu annuel',
  saisonnier_direct: 'Saisonnier direct',
  saisonnier_plateforme: 'Saisonnier plateforme',
};

const PERIODICITE_LABELS: Record<string, string> = {
  forfait: 'forfait',
  jour: '/ jour',
  semaine: '/ semaine',
  mois: '/ mois',
  annee: '/ an',
};

export const dynamic = 'force-dynamic';

export default async function LotDetailPage({ params }: { params: { id: string } }) {
  let lot: any = null;
  let lotLevels: LevelWithRooms[] = [];
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

    const levelRows = await db
      .select({
        id: levels.id,
        name: levels.name,
        sortOrder: levels.sortOrder,
      })
      .from(levels)
      .where(eq(levels.lotId, lot.id))
      .orderBy(asc(levels.sortOrder));

    if (levelRows.length > 0) {
      const roomRows = await db
        .select({
          id: rooms.id,
          name: rooms.name,
          surfaceM2: rooms.surfaceM2,
          levelId: rooms.levelId,
        })
        .from(rooms)
        .innerJoin(levels, eq(rooms.levelId, levels.id))
        .where(eq(levels.lotId, lot.id))
        .orderBy(asc(rooms.name));

      lotLevels = levelRows.map((lv) => ({
        id: lv.id,
        name: lv.name,
        sortOrder: lv.sortOrder,
        rooms: roomRows
          .filter((r) => r.levelId === lv.id)
          .map((r) => ({ id: r.id, name: r.name, surfaceM2: r.surfaceM2 })),
      }));
    }
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  let lotMarches: any[] = [];
  let lotLocations: any[] = [];
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

    lotLocations = await db
      .select({
        id: locations.id,
        typeLocation: locations.typeLocation,
        dateDebut: locations.dateDebut,
        dateFin: locations.dateFin,
        prixLocation: locations.prixLocation,
        prix: locations.prix,
        periodicite: locations.periodicite,
        customerId: customers.id,
        customerCompanyName: customers.companyName,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
      })
      .from(locations)
      .innerJoin(customers, eq(customers.id, locations.customerId))
      .where(eq(locations.lotId, lot.id))
      .orderBy(asc(locations.dateDebut));
  }

  if (!lot) {
    return (
      <div className="card p-6 text-sm text-emerald-700">
        Connexion DB indisponible : {dbError}
      </div>
    );
  }

  const totalRooms = lotLevels.reduce((acc, lv) => acc + lv.rooms.length, 0);

  const overviewTab = (
    <div className="grid gap-4 md:grid-cols-3">
      <Kpi
        label="Surface Carrez"
        value={lot.surfaceCarrez ? `${lot.surfaceCarrez} m²` : '—'}
      />
      <Kpi label="Niveaux" value={lotLevels.length} />
      <Kpi label="Pièces" value={totalRooms} />
    </div>
  );

  const identityTab = (
    <div className="card p-5">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
        <Row label="Nom">{lot.name}</Row>
        <Row label="Type">
          <span className="badge-neutral">{lot.type}</span>
        </Row>
        <Row label="Surface Carrez">
          <span className="tnum">
            {lot.surfaceCarrez ? `${lot.surfaceCarrez} m²` : '—'}
          </span>
        </Row>
        <Row label="Statut">
          <span className="badge-neutral">
            {LOT_STATUS_LABELS[lot.status] ?? lot.status}
          </span>
        </Row>
        <Row label="Bien parent">
          <Link href={`/biens/properties/${lot.propertyId}`} className="link-cell-soft">
            {lot.propertyName}
          </Link>
        </Row>
        <Row label="Société">
          <Link href={`/societes/${lot.companyId}`} className="link-cell-soft">
            {lot.companyName}
          </Link>
        </Row>
        {lot.notes && (
          <div className="col-span-2">
            <dt className="text-[11px] uppercase tracking-wider text-zinc-500">Notes</dt>
            <dd className="mt-1 whitespace-pre-wrap text-zinc-700">{lot.notes}</dd>
          </div>
        )}
      </dl>
    </div>
  );

  const niveauxTab = (
    <div className="card p-6">
      <LevelsRoomsManager lotId={lot.id} levels={lotLevels} />
    </div>
  );

  const marchesTab = (
    <div className="card p-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Marchés affectés à ce lot
        </h2>
        <Link
          href={`/biens/properties/${lot.propertyId}/marches/new`}
          className="text-[12px] text-emerald-700 underline decoration-emerald-700/35 underline-offset-[3px] hover:decoration-emerald-700"
        >
          + Nouveau marché (sur le bien)
        </Link>
      </div>
      {lotMarches.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Aucun marché affecté à ce lot. La création se fait depuis la fiche du bien parent.
        </p>
      ) : (
        <ul className="space-y-2">
          {lotMarches.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-md border border-zinc-100 p-3"
            >
              <div className="min-w-0 flex-1">
                <Link href={`/marches/${m.id}`} className="link-cell text-[13px]">
                  {m.name}
                </Link>
                <div className="mt-0.5 text-[12px] text-zinc-500">
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
  );

  const locationsTab = (
    <div className="card p-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Locataires & contrats
        </h2>
        <Link
          href={`/locations/new?lotId=${lot.id}&returnTo=/biens/lots/${lot.id}`}
          className="btn-secondary"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Nouvelle location
        </Link>
      </div>

      {lotLocations.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Aucune location pour ce lot. Une location lie un client (locataire) à ce lot avec un
          type, des dates et un loyer.
        </p>
      ) : (
        <ul className="space-y-2">
          {lotLocations.map((l) => {
            const customerLabel =
              l.customerCompanyName ||
              `${l.customerFirstName ?? ''} ${l.customerLastName ?? ''}`.trim() ||
              'client';
            const priceText =
              l.prixLocation
                ? `${Number(l.prixLocation).toLocaleString('fr-FR')} € ${PERIODICITE_LABELS[l.periodicite] ?? ''}`
                : l.prix
                ? `${Number(l.prix).toLocaleString('fr-FR')} € ${PERIODICITE_LABELS[l.periodicite] ?? ''}`
                : null;
            return (
              <li
                key={l.id}
                className="flex items-center justify-between rounded-md border border-zinc-100 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3">
                    <Link href={`/clients/${l.customerId}`} className="link-cell text-[13px]">
                      {customerLabel}
                    </Link>
                    <span className="badge-neutral">
                      {LOCATION_TYPE_LABELS[l.typeLocation] ?? l.typeLocation}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-zinc-500">
                    Du {formatDate(l.dateDebut)}
                    {l.dateFin ? ` au ${formatDate(l.dateFin)}` : ' (en cours)'}
                    {priceText && <span className="ml-2 tnum">· {priceText}</span>}
                  </div>
                </div>
                <form action={deleteLocationAction}>
                  <input type="hidden" name="id" value={l.id} />
                  <button
                    type="submit"
                    title="Supprimer cette location"
                    className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const documentsTab = (
    <div className="card p-6">
      <p className="text-sm text-zinc-500">
        Diagnostics, photos, etc. — branchement MinIO à venir sur ce scope. L'upload est déjà
        actif sur les fournisseurs, clients, sociétés et marchés.
      </p>
    </div>
  );

  const tabs: TabItem[] = [
    { id: 'overview', label: "Vue d'ensemble", content: overviewTab },
    { id: 'identity', label: 'Identité', content: identityTab },
    {
      id: 'niveaux',
      label: 'Niveaux & pièces',
      count: lotLevels.length || undefined,
      content: niveauxTab,
    },
    {
      id: 'locations',
      label: 'Locations',
      count: lotLocations.length || undefined,
      content: locationsTab,
    },
    {
      id: 'marches',
      label: 'Marchés',
      count: lotMarches.length || undefined,
      content: marchesTab,
    },
    { id: 'documents', label: 'Documents', content: documentsTab },
  ];

  return (
    <div className="space-y-8">
      <Link
        href={`/biens/properties/${lot.propertyId}`}
        className="inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-emerald-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {lot.propertyName}
      </Link>

      <header className="flex items-start justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
            <Link href={`/biens/properties/${lot.propertyId}`} className="hover:text-emerald-800">
              {lot.propertyName}
            </Link>
          </div>
          <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">{lot.name}</span>
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            {lot.type} · <span className="badge-neutral">
              {LOT_STATUS_LABELS[lot.status] ?? lot.status}
            </span>
            {lot.surfaceCarrez && (
              <span className="ml-2 tnum text-zinc-600">{lot.surfaceCarrez} m²</span>
            )}
          </p>
        </div>
        <Link href={`/biens/lots/${lot.id}/edit`} className="btn-secondary">
          <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Modifier
        </Link>
      </header>

      <Tabs tabs={tabs} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-1 text-zinc-700">{children}</dd>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-5">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-medium tabular-nums text-zinc-900">{value}</div>
    </div>
  );
}
