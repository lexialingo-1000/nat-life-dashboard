import { db } from '@/db/client';
import {
  lots,
  lotDocuments,
  properties,
  companies,
  levels,
  rooms,
  marchesTravaux,
  marcheLotAffectations,
  suppliers,
  locations,
  customers,
  documentTypes,
} from '@/db/schema';
import { eq, asc, desc, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Tabs, type TabItem } from '@/components/tabs';
import { BackLink } from '@/components/back-link';
import { SectionTitle } from '@/components/section-title';
import { DocumentsManager } from '@/components/documents-manager';
import { LevelsRoomsManager, type LevelWithRooms } from '@/components/levels-rooms-manager';
import { DeleteButton } from '@/components/delete-button';
import { LotMarchesTable, type LotMarcheRow } from '@/components/lot-marches-table';
import { deleteLocationAction } from '@/app/(dashboard)/locations/actions';
import {
  LocationsTable,
  type LocationRow,
  type LocationStatus,
} from '@/app/(dashboard)/locations/locations-table';
import {
  uploadLotDocumentAction,
  deleteLotDocumentAction,
  getLotDocumentUrlAction,
} from '../../actions';
import { formatDate } from '@/lib/utils';
import { slugify } from '@/lib/storage/minio';

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
        dateFinPrevu: marchesTravaux.dateFinPrevu,
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
      .orderBy(desc(locations.dateDebut));
  }

  let lotDocs: any[] = [];
  let lotDocTypes: any[] = [];
  if (lot) {
    lotDocs = await db
      .select({
        id: lotDocuments.id,
        name: lotDocuments.name,
        typeLabel: documentTypes.label,
        storageKey: lotDocuments.storageKey,
        expiresAt: lotDocuments.expiresAt,
        documentDate: lotDocuments.documentDate,
        uploadedAt: lotDocuments.uploadedAt,
      })
      .from(lotDocuments)
      .innerJoin(documentTypes, eq(lotDocuments.typeId, documentTypes.id))
      .where(eq(lotDocuments.lotId, lot.id))
      .orderBy(asc(documentTypes.sortOrder));

    lotDocTypes = await db
      .select({
        id: documentTypes.id,
        label: documentTypes.label,
        hasExpiration: documentTypes.hasExpiration,
      })
      .from(documentTypes)
      .where(and(eq(documentTypes.scope, 'lot'), eq(documentTypes.isActive, true)))
      .orderBy(asc(documentTypes.sortOrder));
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
        <SectionTitle className="mb-0">Travaux affectés à ce lot</SectionTitle>
        <Link
          href={`/biens/properties/${lot.propertyId}/marches/new`}
          className="text-[12px] text-emerald-700 underline decoration-emerald-700/35 underline-offset-[3px] hover:decoration-emerald-700"
        >
          + Nouveau marché (sur le bien)
        </Link>
      </div>
      <LotMarchesTable rows={lotMarches as LotMarcheRow[]} />
    </div>
  );

  const computeStatus = (dateDebut: string, dateFin: string | null): LocationStatus => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const debut = new Date(dateDebut);
    if (dateFin && new Date(dateFin) < today) return 'inactif';
    if (debut > today) return 'a_venir';
    return 'actif';
  };

  const lotLocationRows: LocationRow[] = lotLocations.map((l: any) => {
    const customerLabel =
      l.customerCompanyName ||
      `${l.customerFirstName ?? ''} ${l.customerLastName ?? ''}`.trim() ||
      'client';
    return {
      id: l.id,
      propertyId: lot.propertyId,
      propertyName: lot.propertyName,
      lotId: lot.id,
      lotName: lot.name,
      customerId: l.customerId,
      customerLabel,
      typeLocation: l.typeLocation,
      dateDebut: l.dateDebut,
      dateFin: l.dateFin,
      status: computeStatus(l.dateDebut, l.dateFin),
      prixLocation: l.prixLocation ?? l.prix ?? null,
      periodicite: l.periodicite,
    };
  });

  const locationsTab = (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <SectionTitle className="mb-0">Locataires & contrats</SectionTitle>
        <Link
          href={`/locations/new?lotId=${lot.id}&returnTo=/biens/lots/${lot.id}`}
          className="btn-secondary"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Nouvelle location
        </Link>
      </div>

      <div className="card overflow-hidden">
        <LocationsTable
          rows={lotLocationRows}
          hideColumns={['lot', 'property']}
          deleteAction={deleteLocationAction}
          emptyMessage="Aucune location pour ce lot. Une location lie un client (locataire) à ce lot avec un type, des dates et un loyer."
        />
      </div>
    </div>
  );

  const documentsTab = (
    <div className="card p-6">
      <DocumentsManager
        scope="lots"
        parentId={lot.id}
        parentSlug={slugify(`${lot.propertyName}-${lot.name}`)}
        parentIdFieldName="lotId"
        documents={lotDocs.map((d) => ({
          id: d.id,
          name: d.name,
          typeLabel: d.typeLabel,
          storageKey: d.storageKey,
          documentDate: d.documentDate,
          expiresAt: d.expiresAt,
          uploadedAt: d.uploadedAt instanceof Date ? d.uploadedAt.toISOString() : String(d.uploadedAt),
        }))}
        availableTypes={lotDocTypes}
        uploadAction={uploadLotDocumentAction}
        deleteAction={deleteLotDocumentAction}
        getUrlAction={getLotDocumentUrlAction}
      />
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
      label: 'Travaux',
      count: lotMarches.length || undefined,
      content: marchesTab,
    },
    { id: 'documents', label: 'Documents', count: lotDocs.length, content: documentsTab },
  ];

  return (
    <div className="space-y-8">
      <BackLink fallbackHref={`/biens/properties/${lot.propertyId}`} label={lot.propertyName} />

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
