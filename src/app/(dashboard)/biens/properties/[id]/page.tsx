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
} from '@/db/schema';
import { eq, asc, and, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { DeleteButton } from '@/components/delete-button';
import {
  deletePropertyAction,
  uploadPropertyDocumentAction,
  deletePropertyDocumentAction,
  getPropertyDocumentUrlAction,
} from '../actions';
import { formatDate } from '@/lib/utils';
import { Tabs, type TabItem } from '@/components/tabs';
import { NotesCard } from '@/components/notes-card';
import { DocumentsManager } from '@/components/documents-manager';
import { LevelsRoomsManager, type LevelWithRooms } from '@/components/levels-rooms-manager';
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

  let lotsLevels: { lotId: string; lotName: string; levels: LevelWithRooms[] }[] = [];
  let totalLevels = 0;
  if (property && propertyLots.length > 0) {
    const lotIds = propertyLots.map((l) => l.id);

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

    lotsLevels = propertyLots.map((lot) => ({
      lotId: lot.id,
      lotName: lot.name,
      levels: levelRows
        .filter((lv) => lv.lotId === lot.id)
        .map((lv) => ({
          id: lv.id,
          name: lv.name,
          sortOrder: lv.sortOrder,
          rooms: roomRows
            .filter((r) => r.levelId === lv.id)
            .map((r) => ({ id: r.id, name: r.name, surfaceM2: r.surfaceM2 })),
        })),
    }));
  }

  let propertyMarches: any[] = [];
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

  const overviewTab = (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi label="Lots" value={propertyLots.length} />
        <Kpi label="Marchés de travaux" value={propertyMarches.length} />
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

  const identityTab = (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-5">
        <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Identité
        </h2>
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
        </dl>
      </div>
      <div className="card p-5">
        <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Acquisition
        </h2>
        <dl className="space-y-2 text-[13px]">
          <Row label="Date d'achat">{formatDate(property.purchaseDate)}</Row>
          <Row label="Prix">
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
    </div>
  );

  const notaireTab = (
    <div className="card max-w-2xl p-5">
      <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        Notaire
      </h2>
      <dl className="space-y-2 text-[13px]">
        <Row label="Nom">{notaire.name ?? '—'}</Row>
        <Row label="Étude">{notaire.etude ?? '—'}</Row>
        <Row label="Téléphone">{notaire.phone ?? '—'}</Row>
        <Row label="Email">{notaire.email ?? '—'}</Row>
      </dl>
    </div>
  );

  const lotsTab = (
    <div className="card overflow-hidden">
      {propertyLots.length === 0 ? (
        <p className="p-6 text-center text-sm text-zinc-500">
          Aucun lot dans ce bien.
        </p>
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>Nom</th>
              <th className="w-[140px]">Type</th>
              <th className="w-[140px]">Surface Carrez</th>
              <th className="w-[120px]">Statut</th>
            </tr>
          </thead>
          <tbody>
            {propertyLots.map((l, i) => (
              <tr key={l.id} className={i % 2 === 1 ? 'bg-zinc-50/40' : undefined}>
                <td>
                  <Link href={`/biens/lots/${l.id}`} className="link-cell">
                    {l.name}
                  </Link>
                </td>
                <td>
                  <span className="badge-neutral">{l.type}</span>
                </td>
                <td className="tnum text-[12px] text-zinc-600">
                  {l.surfaceCarrez ? `${l.surfaceCarrez} m²` : '—'}
                </td>
                <td>
                  <span
                    className={
                      l.status === 'vacant'
                        ? 'badge-neutral'
                        : l.status === 'travaux'
                        ? 'badge-amber'
                        : 'badge-emerald'
                    }
                  >
                    {l.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const marchesTab = (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href={`/biens/properties/${property.id}/marches/new`} className="btn-primary">
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Nouveau marché
        </Link>
      </div>
      {propertyMarches.length === 0 ? (
        <div className="card p-6 text-center text-sm text-zinc-500">
          Aucun marché pour ce bien. Crée-en un pour commencer le suivi.
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

  const niveauxTab = (() => {
    if (propertyLots.length === 0) {
      return (
        <div className="card p-6">
          <p className="text-sm text-zinc-500">
            Ajoute un lot d'abord pour pouvoir y déclarer des niveaux et pièces. Un niveau est
            rattaché à un lot précis (un immeuble peut héberger plusieurs lots avec leur propre
            découpage).
          </p>
          <p className="mt-3 text-[12px] text-zinc-400">
            Un lot se crée depuis la fiche de ce bien (à venir) ou via la page Biens.
          </p>
        </div>
      );
    }

    if (propertyLots.length === 1) {
      const only = lotsLevels[0];
      return (
        <div className="card p-6">
          <LevelsRoomsManager lotId={only.lotId} levels={only.levels} />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {lotsLevels.map((bucket) => (
          <div key={bucket.lotId} className="card p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                {bucket.lotName}
              </h3>
              <Link
                href={`/biens/lots/${bucket.lotId}`}
                className="text-[12px] text-emerald-700 underline decoration-emerald-700/35 underline-offset-[3px] hover:decoration-emerald-700"
              >
                Ouvrir la fiche du lot →
              </Link>
            </div>
            <LevelsRoomsManager lotId={bucket.lotId} levels={bucket.levels} />
          </div>
        ))}
      </div>
    );
  })();

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
    { id: 'identity', label: 'Identité', content: identityTab },
    { id: 'notaire', label: 'Notaire', content: notaireTab },
    { id: 'lots', label: 'Lots', count: propertyLots.length, content: lotsTab },
    {
      id: 'niveaux',
      label: 'Niveaux & pièces',
      count: totalLevels || undefined,
      content: niveauxTab,
    },
    { id: 'marches', label: 'Marchés', count: propertyMarches.length, content: marchesTab },
    { id: 'documents', label: 'Documents', count: propertyDocs.length, content: documentsTab },
  ];

  return (
    <div className="space-y-8">
      <Link
        href="/biens"
        className="inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-emerald-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Biens immobiliers
      </Link>

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
