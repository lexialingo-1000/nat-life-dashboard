import { db } from '@/db/client';
import {
  properties,
  propertyDocuments,
  lots,
  companies,
  marchesTravaux,
  marcheLotAffectations,
  suppliers,
  levels,
  rooms,
  documentTypes,
  locations,
  customers,
} from '@/db/schema';
import { eq, asc, and, sql, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Pencil, Plus } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { SectionTitle } from '@/components/section-title';
import { DeleteButton } from '@/components/delete-button';
import {
  deletePropertyAction,
  uploadPropertyDocumentAction,
  deletePropertyDocumentAction,
  getPropertyDocumentUrlAction,
} from '../actions';
import { deleteLocationAction } from '@/app/(dashboard)/locations/actions';
import {
  LocationsTable,
  type LocationRow,
  type LocationStatus,
} from '@/app/(dashboard)/locations/locations-table';
import { formatDate } from '@/lib/utils';
import { Tabs, type TabItem } from '@/components/tabs';
import { NotesCard } from '@/components/notes-card';
import { DocumentsManager } from '@/components/documents-manager';
import {
  PropertyStructureTree,
  type PropertyTree,
} from '@/components/property-structure-tree';
import { slugify } from '@/lib/storage/minio';

const MARCHE_STATUS_LABELS: Record<string, string> = {
  devis_recu: 'Devis reçu',
  signe: 'Signé',
  en_cours: 'En cours',
  livre: 'Livré',
  conteste: 'Contesté',
  annule: 'Annulé',
};

export const dynamic = 'force-dynamic';

function computeLocationStatus(dateDebut: string, dateFin: string | null): LocationStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const debut = new Date(dateDebut);
  if (dateFin && new Date(dateFin) < today) return 'inactif';
  if (debut > today) return 'a_venir';
  return 'actif';
}

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  let property: any = null;
  let propertyLots: any[] = [];
  let dbError: string | null = null;
  try {
    const rows = await db
      .select({
        id: properties.id,
        name: properties.name,
        type: properties.type,
        address: properties.address,
        city: properties.city,
        postalCode: properties.postalCode,
        purchaseDate: properties.purchaseDate,
        purchasePrice: properties.purchasePrice,
        notaire: properties.notaire,
        cadastre: properties.cadastre,
        notes: properties.notes,
        companyName: companies.name,
        companyId: companies.id,
      })
      .from(properties)
      .innerJoin(companies, eq(properties.companyId, companies.id))
      .where(eq(properties.id, params.id))
      .limit(1);
    if (rows.length === 0) notFound();
    property = rows[0];

    propertyLots = await db
      .select()
      .from(lots)
      .where(eq(lots.propertyId, property.id))
      .orderBy(asc(lots.name));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  let levelsByLot: Map<string, { id: string; name: string; sortOrder: number }[]> = new Map();
  let roomsByLevel: Map<string, { id: string; name: string; surfaceM2: string | null }[]> =
    new Map();
  let totalLevels = 0;

  if (property && propertyLots.length > 0) {
    const levelRows = await db
      .select({
        id: levels.id,
        name: levels.name,
        sortOrder: levels.sortOrder,
        lotId: levels.lotId,
      })
      .from(levels)
      .innerJoin(lots, eq(lots.id, levels.lotId))
      .where(eq(lots.propertyId, property.id))
      .orderBy(asc(levels.sortOrder));

    const roomRows = levelRows.length
      ? await db
          .select({
            id: rooms.id,
            name: rooms.name,
            surfaceM2: rooms.surfaceM2,
            levelId: rooms.levelId,
          })
          .from(rooms)
          .innerJoin(levels, eq(levels.id, rooms.levelId))
          .innerJoin(lots, eq(lots.id, levels.lotId))
          .where(eq(lots.propertyId, property.id))
          .orderBy(asc(rooms.name))
      : [];

    totalLevels = levelRows.length;

    for (const lv of levelRows) {
      const arr = levelsByLot.get(lv.lotId) ?? [];
      arr.push({ id: lv.id, name: lv.name, sortOrder: lv.sortOrder });
      levelsByLot.set(lv.lotId, arr);
    }
    for (const r of roomRows) {
      const arr = roomsByLevel.get(r.levelId) ?? [];
      arr.push({ id: r.id, name: r.name, surfaceM2: r.surfaceM2 });
      roomsByLevel.set(r.levelId, arr);
    }
  }

  let propertyMarches: any[] = [];
  let propertyLocations: any[] = [];
  if (property) {
    propertyMarches = await db
      .select({
        id: marchesTravaux.id,
        name: marchesTravaux.name,
        status: marchesTravaux.status,
        amountHt: marchesTravaux.amountHt,
        dateDebutPrevu: marchesTravaux.dateDebutPrevu,
        supplierName: suppliers.companyName,
        lotsConcernes: sql<string | null>`(
          SELECT string_agg(${lots.name}, ', ' ORDER BY ${lots.name})
          FROM ${marcheLotAffectations}
          INNER JOIN ${lots} ON ${lots.id} = ${marcheLotAffectations.lotId}
          WHERE ${marcheLotAffectations.marcheId} = ${marchesTravaux.id}
        )`,
      })
      .from(marchesTravaux)
      .innerJoin(suppliers, eq(marchesTravaux.supplierId, suppliers.id))
      .where(eq(marchesTravaux.propertyId, property.id))
      .orderBy(asc(marchesTravaux.createdAt));

    propertyLocations = await db
      .select({
        id: locations.id,
        typeLocation: locations.typeLocation,
        dateDebut: locations.dateDebut,
        dateFin: locations.dateFin,
        prixLocation: locations.prixLocation,
        prix: locations.prix,
        periodicite: locations.periodicite,
        lotId: lots.id,
        lotName: lots.name,
        customerId: customers.id,
        customerCompanyName: customers.companyName,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
      })
      .from(locations)
      .innerJoin(lots, eq(lots.id, locations.lotId))
      .innerJoin(customers, eq(customers.id, locations.customerId))
      .where(eq(lots.propertyId, property.id))
      .orderBy(desc(locations.dateDebut));
  }

  if (!property) {
    return (
      <div className="card p-6 text-[13px] text-emerald-700">
        Connexion DB indisponible : {dbError}
      </div>
    );
  }

  const propertyDocs = await db
    .select({
      id: propertyDocuments.id,
      name: propertyDocuments.name,
      typeLabel: documentTypes.label,
      storageKey: propertyDocuments.storageKey,
      expiresAt: propertyDocuments.expiresAt,
      documentDate: propertyDocuments.documentDate,
      uploadedAt: propertyDocuments.uploadedAt,
    })
    .from(propertyDocuments)
    .innerJoin(documentTypes, eq(propertyDocuments.typeId, documentTypes.id))
    .where(eq(propertyDocuments.propertyId, property.id))
    .orderBy(asc(documentTypes.sortOrder));

  const propertyDocTypes = await db
    .select({
      id: documentTypes.id,
      label: documentTypes.label,
      hasExpiration: documentTypes.hasExpiration,
    })
    .from(documentTypes)
    .where(and(eq(documentTypes.scope, 'property'), eq(documentTypes.isActive, true)))
    .orderBy(asc(documentTypes.sortOrder));

  const notaire = (property.notaire as any) ?? {};
  const hasNotaire = Boolean(notaire.name || notaire.etude || notaire.phone || notaire.email);

  const tree: PropertyTree = {
    id: property.id,
    name: property.name,
    type: property.type,
    address: property.address,
    postalCode: property.postalCode,
    city: property.city,
    companyId: property.companyId,
    companyName: property.companyName,
    lots: propertyLots.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      status: l.status,
      surfaceCarrez: l.surfaceCarrez,
      levels: (levelsByLot.get(l.id) ?? []).map((lv) => ({
        id: lv.id,
        name: lv.name,
        rooms: roomsByLevel.get(lv.id) ?? [],
      })),
    })),
  };

  const propertyLocationRows: LocationRow[] = propertyLocations.map((l: any) => {
    const customerLabel =
      l.customerCompanyName ||
      `${l.customerFirstName ?? ''} ${l.customerLastName ?? ''}`.trim() ||
      'client';
    return {
      id: l.id,
      propertyId: property.id,
      propertyName: property.name,
      lotId: l.lotId,
      lotName: l.lotName,
      customerId: l.customerId,
      customerLabel,
      typeLocation: l.typeLocation,
      dateDebut: l.dateDebut,
      dateFin: l.dateFin,
      status: computeLocationStatus(l.dateDebut, l.dateFin),
      prixLocation: l.prixLocation ?? l.prix ?? null,
      periodicite: l.periodicite,
    };
  });

  const overviewTab = (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Lots" value={propertyLots.length} />
        <Kpi label="Niveaux" value={totalLevels} />
        <Kpi label="Travaux" value={propertyMarches.length} />
        <Kpi
          label="Lots loués"
          value={
            propertyLots.filter((l) =>
              ['loue_annuel', 'loue_saisonnier'].includes(l.status as string)
            ).length
          }
        />
      </div>
      <NotesCard notes={property.notes} />
    </div>
  );

  const bienTab = (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle>Identité</SectionTitle>
          <dl className="space-y-2 text-[13px]">
            <Row label="Nom">{property.name}</Row>
            <Row label="Type">{property.type}</Row>
            <Row label="Adresse">{property.address ?? '—'}</Row>
            <Row label="Code postal / ville">
              {property.postalCode || property.city
                ? `${property.postalCode ?? ''} ${property.city ?? ''}`.trim()
                : '—'}
            </Row>
            <Row label="Société">
              <Link href={`/societes/${property.companyId}`} className="hover:text-emerald-700">
                {property.companyName}
              </Link>
            </Row>
            <Row label="Date d'achat">{formatDate(property.purchaseDate)}</Row>
            <Row label="Prix d'achat">
              <span className="tnum">
                {property.purchasePrice
                  ? `${Number(property.purchasePrice).toLocaleString('fr-FR')} €`
                  : '—'}
              </span>
            </Row>
            <Row label="Cadastre">
              <span className="font-mono text-[12px]">{property.cadastre ?? '—'}</span>
            </Row>
          </dl>
        </div>

        <details open={hasNotaire} className="card p-5 group">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChevronRight
                  className="h-4 w-4 text-zinc-500 transition-transform duration-150 group-open:rotate-90"
                  strokeWidth={2}
                />
                <h2 className="text-[15px] font-medium tracking-tight text-zinc-900">
                  Notaire
                </h2>
              </div>
              {!hasNotaire && (
                <span className="text-[11px] text-zinc-400">Aucune information</span>
              )}
            </div>
          </summary>
          <dl className="mt-4 space-y-2 text-[13px]">
            <Row label="Nom">{notaire.name ?? '—'}</Row>
            <Row label="Étude">{notaire.etude ?? '—'}</Row>
            <Row label="Téléphone">
              <span className="font-mono">{notaire.phone ?? '—'}</span>
            </Row>
            <Row label="Email">{notaire.email ?? '—'}</Row>
          </dl>
        </details>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <SectionTitle className="mb-0">Structure</SectionTitle>
          <p className="text-[11px] text-zinc-500">
            Bien → Lots → Niveaux → Pièces. Clic sur un lot pour ouvrir sa fiche complète.
          </p>
        </div>
        <PropertyStructureTree tree={tree} />
      </div>
    </div>
  );

  const locationsTab = (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Locations sur ce bien
        </h2>
        <p className="text-[11px] text-zinc-500">
          Toutes les locations actuelles, à venir et passées sur les lots de ce bien.
        </p>
      </div>
      <div className="card overflow-hidden">
        <LocationsTable
          rows={propertyLocationRows}
          hideColumns={['property']}
          deleteAction={deleteLocationAction}
          emptyMessage="Aucune location pour les lots de ce bien."
        />
      </div>
    </div>
  );

  const travauxTab = (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href={`/biens/properties/${property.id}/marches/new`} className="btn-primary">
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Nouveau marché
        </Link>
      </div>
      {propertyMarches.length === 0 ? (
        <div className="card p-6 text-center text-sm text-zinc-500">
          Aucun marché de travaux pour ce bien. Crée-en un pour commencer le suivi.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Lots concernés</th>
                <th>Fournisseur</th>
                <th className="w-[120px]">Montant HT</th>
                <th className="w-[120px]">Statut</th>
              </tr>
            </thead>
            <tbody>
              {propertyMarches.map((m, i) => (
                <tr key={m.id} className={i % 2 === 1 ? 'bg-zinc-50/40' : undefined}>
                  <td>
                    <Link href={`/marches/${m.id}`} className="link-cell">
                      {m.name}
                    </Link>
                  </td>
                  <td className="text-[12px] text-zinc-500">
                    {m.lotsConcernes ?? (
                      <span className="text-zinc-400">parties communes</span>
                    )}
                  </td>
                  <td className="text-[12px] text-zinc-600">{m.supplierName ?? '—'}</td>
                  <td className="tnum text-[12px] text-zinc-700">
                    {m.amountHt
                      ? `${Number(m.amountHt).toLocaleString('fr-FR')} €`
                      : '—'}
                  </td>
                  <td>
                    <span className="badge-neutral">
                      {MARCHE_STATUS_LABELS[m.status] ?? m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const documentsTab = (
    <div className="card p-6">
      <DocumentsManager
        scope="properties"
        parentId={property.id}
        parentSlug={slugify(property.name)}
        parentIdFieldName="propertyId"
        documents={propertyDocs.map((d) => ({
          id: d.id,
          name: d.name,
          typeLabel: d.typeLabel,
          storageKey: d.storageKey,
          documentDate: d.documentDate,
          expiresAt: d.expiresAt,
          uploadedAt: (d.uploadedAt instanceof Date ? d.uploadedAt.toISOString() : String(d.uploadedAt)),
        }))}
        availableTypes={propertyDocTypes}
        uploadAction={uploadPropertyDocumentAction}
        deleteAction={deletePropertyDocumentAction}
        getUrlAction={getPropertyDocumentUrlAction}
      />
    </div>
  );

  const tabs: TabItem[] = [
    { id: 'overview', label: "Vue d'ensemble", content: overviewTab },
    { id: 'bien', label: 'Bien', count: propertyLots.length, content: bienTab },
    {
      id: 'locations',
      label: 'Locations',
      count: propertyLocations.length || undefined,
      content: locationsTab,
    },
    { id: 'travaux', label: 'Travaux', count: propertyMarches.length, content: travauxTab },
    { id: 'documents', label: 'Documents', count: propertyDocs.length, content: documentsTab },
  ];

  return (
    <div className="space-y-8">
      <BackLink fallbackHref="/biens" label="Biens immobiliers" />

      <header className="flex items-start justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
            <Link href={`/societes/${property.companyId}`} className="hover:text-emerald-800">
              {property.companyName}
            </Link>
          </div>
          <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">{property.name}</span>
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            {property.type} · {property.address ?? 'adresse à compléter'}
            {property.postalCode && property.city && ` · ${property.postalCode} ${property.city}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/biens/properties/${property.id}/edit`} className="btn-secondary">
            <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Modifier
          </Link>
          <DeleteButton
            action={deletePropertyAction}
            id={property.id}
            label="Supprimer"
            confirmationPhrase={property.name}
            description={`Cette action est irréversible. L'immeuble "${property.name}" et tous ses lots seront supprimés.`}
          />
        </div>
      </header>

      <Tabs tabs={tabs} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-700">{children}</dd>
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
