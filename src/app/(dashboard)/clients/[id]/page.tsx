import { db } from '@/db/client';
import {
  customers,
  customerDocuments,
  documentTypes,
  locations,
  lots,
  properties,
} from '@/db/schema';
import { eq, and, asc, desc, or, isNull, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  uploadCustomerDocumentAction,
  deleteCustomerDocumentAction,
  getCustomerDocumentUrlAction,
  toggleCustomerActiveAction,
  deleteCustomerAction,
} from '../actions';
import { deleteLocationAction } from '@/app/(dashboard)/locations/actions';
import {
  LocationsTable,
  type LocationRow,
  type LocationStatus,
} from '@/app/(dashboard)/locations/locations-table';
import { DocumentsManager } from '@/components/documents-manager';
import { Tabs, type TabItem } from '@/components/tabs';
import { NotesCard } from '@/components/notes-card';
import { DeleteButton } from '@/components/delete-button';
import { RequiredDocumentsWidget } from '@/components/required-documents-widget';
import { slugify } from '@/lib/storage/minio';
import { formatDate } from '@/lib/utils';

function computeLocationStatus(dateDebut: string, dateFin: string | null): LocationStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const debut = new Date(dateDebut);
  if (dateFin && new Date(dateFin) < today) return 'inactif';
  if (debut > today) return 'a_venir';
  return 'actif';
}

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

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const customerRow = await db
    .select()
    .from(customers)
    .where(eq(customers.id, params.id))
    .limit(1);
  if (customerRow.length === 0) notFound();
  const customer = customerRow[0];

  const docs = await db
    .select({
      id: customerDocuments.id,
      typeId: customerDocuments.typeId,
      name: customerDocuments.name,
      typeLabel: documentTypes.label,
      storageKey: customerDocuments.storageKey,
      expiresAt: customerDocuments.expiresAt,
      documentDate: customerDocuments.documentDate,
      uploadedAt: customerDocuments.uploadedAt,
    })
    .from(customerDocuments)
    .innerJoin(documentTypes, eq(customerDocuments.typeId, documentTypes.id))
    .where(eq(customerDocuments.customerId, customer.id))
    .orderBy(asc(documentTypes.sortOrder));

  const requiredCustomerTypes = await db
    .select({
      id: documentTypes.id,
      label: documentTypes.label,
      appliesToTenantType: documentTypes.appliesToTenantType,
    })
    .from(documentTypes)
    .where(
      and(
        eq(documentTypes.scope, 'customer'),
        eq(documentTypes.isActive, true),
        eq(documentTypes.isRequired, true),
        or(
          isNull(documentTypes.appliesToTenantType),
          eq(documentTypes.appliesToTenantType, 'all'),
          customer.tenantType
            ? eq(documentTypes.appliesToTenantType, customer.tenantType)
            : sql`false`
        )
      )
    )
    .orderBy(asc(documentTypes.sortOrder));

  const uploadedTypeIds = new Set(docs.map((d) => d.typeId));
  const missingRequiredTypes = requiredCustomerTypes
    .filter((t) => !uploadedTypeIds.has(t.id))
    .map((t) => ({ id: t.id, label: t.label }));

  const customerTypes = await db
    .select({
      id: documentTypes.id,
      label: documentTypes.label,
      hasExpiration: documentTypes.hasExpiration,
    })
    .from(documentTypes)
    .where(and(eq(documentTypes.scope, 'customer'), eq(documentTypes.isActive, true)))
    .orderBy(asc(documentTypes.sortOrder));

  const customerLocations = await db
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
      propertyId: properties.id,
      propertyName: properties.name,
    })
    .from(locations)
    .innerJoin(lots, eq(lots.id, locations.lotId))
    .innerJoin(properties, eq(properties.id, lots.propertyId))
    .where(eq(locations.customerId, customer.id))
    .orderBy(desc(locations.dateDebut));

  const displayName =
    customer.companyName ??
    `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() ??
    'Client';

  const expiringDocsCount = docs.filter((d) => {
    if (!d.expiresAt) return false;
    const days = Math.floor(
      (new Date(d.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days < 30;
  }).length;

  const tenantHint =
    customer.tenantType === 'LT'
      ? 'Locataire long terme — exigences spécifiques aux baux annuels.'
      : customer.tenantType === 'CT'
      ? 'Locataire court terme — exigences spécifiques aux contrats saisonniers.'
      : 'Client B2B (non-locataire). Seuls les types « Tous » apparaissent ici.';

  const overviewTab = (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi
          label="État"
          value={customer.isActive ? 'Actif' : 'Inactif'}
          variant={customer.isActive ? 'good' : 'warn'}
        />
        <Kpi label="Documents" value={docs.length} />
        <Kpi
          label="Docs à renouveler"
          value={expiringDocsCount}
          variant={expiringDocsCount > 0 ? 'warn' : 'default'}
        />
        <Kpi label="Locations" value={customerLocations.length} />
      </div>
      <RequiredDocumentsWidget
        missingTypes={missingRequiredTypes}
        scopeLabel="client"
        hint={tenantHint}
      />
      <NotesCard notes={customer.notes} />
    </div>
  );

  const tenantTypeLabel =
    customer.tenantType === 'LT'
      ? { text: 'Bail long terme', cls: 'badge-emerald' }
      : customer.tenantType === 'CT'
      ? { text: 'Saisonnier', cls: 'badge-amber' }
      : null;

  const identityTab = (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-5">
        <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Identité
        </h2>
        <dl className="space-y-2 text-[13px]">
          <Row label="Raison sociale">{customer.companyName ?? '—'}</Row>
          <Row label="Prénom">{customer.firstName ?? '—'}</Row>
          <Row label="Nom">{customer.lastName ?? '—'}</Row>
          <Row label="Adresse">{customer.address ?? '—'}</Row>
          <Row label="Statut locataire">
            {tenantTypeLabel ? (
              <span className={tenantTypeLabel.cls}>{tenantTypeLabel.text}</span>
            ) : (
              <span className="text-zinc-400">B2B (non-locataire)</span>
            )}
          </Row>
        </dl>
      </div>
      <div className="card p-5">
        <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Coordonnées & facturation
        </h2>
        <dl className="space-y-2 text-[13px]">
          <Row label="Email">{customer.email ?? '—'}</Row>
          <Row label="Téléphone">
            <span className="font-mono">{customer.phone ?? '—'}</span>
          </Row>
          <Row label="Pennylane ID">
            <span className="font-mono text-[12px]">
              {customer.pennylaneCustomerId ?? '—'}
            </span>
          </Row>
        </dl>
      </div>
    </div>
  );

  const documentsTab = (
    <div className="card p-6">
      <DocumentsManager
        scope="customers"
        parentId={customer.id}
        parentSlug={slugify(displayName)}
        parentIdFieldName="customerId"
        documents={docs.map((d) => ({
          id: d.id,
          name: d.name,
          typeLabel: d.typeLabel,
          storageKey: d.storageKey,
          documentDate: d.documentDate,
          expiresAt: d.expiresAt,
          uploadedAt: (d.uploadedAt instanceof Date ? d.uploadedAt.toISOString() : String(d.uploadedAt)),
        }))}
        availableTypes={customerTypes}
        uploadAction={uploadCustomerDocumentAction}
        deleteAction={deleteCustomerDocumentAction}
        getUrlAction={getCustomerDocumentUrlAction}
      />
    </div>
  );

  const customerLocationRows: LocationRow[] = customerLocations.map((l) => ({
    id: l.id,
    propertyId: l.propertyId,
    propertyName: l.propertyName,
    lotId: l.lotId,
    lotName: l.lotName,
    customerId: customer.id,
    customerLabel: displayName,
    typeLocation: l.typeLocation,
    dateDebut: l.dateDebut,
    dateFin: l.dateFin,
    status: computeLocationStatus(l.dateDebut, l.dateFin),
    prixLocation: l.prixLocation ?? l.prix ?? null,
    periodicite: l.periodicite,
  }));

  const locationsTab = (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Lots & contrats
        </h2>
        <Link
          href={`/locations/new?customerId=${customer.id}&returnTo=/clients/${customer.id}`}
          className="btn-secondary"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Nouvelle location
        </Link>
      </div>

      <div className="card overflow-hidden">
        <LocationsTable
          rows={customerLocationRows}
          hideColumns={['customer']}
          deleteAction={deleteLocationAction}
          emptyMessage="Aucune location pour ce client. Une location lie ce client à un lot d'un bien (locataire annuel ou saisonnier)."
        />
      </div>
    </div>
  );

  const facturesTab = (
    <div className="card p-6">
      <p className="text-sm text-zinc-500">
        Aucune facture pour l'instant. La synchronisation Pennylane (ventes FKA) arrivera en
        V1.5 après l'entrée en vigueur de la réforme facturation électronique (1<sup>er</sup>{' '}
        septembre 2026).
      </p>
      <p className="mt-3 text-[12px] text-zinc-400">
        En attendant, les factures émises peuvent être archivées dans l'onglet « Documents »
        avec le type « Autre ».
      </p>
    </div>
  );

  const tabs: TabItem[] = [
    { id: 'overview', label: "Vue d'ensemble", content: overviewTab },
    { id: 'identity', label: 'Identité', content: identityTab },
    {
      id: 'locations',
      label: 'Locations',
      count: customerLocations.length || undefined,
      content: locationsTab,
    },
    { id: 'documents', label: 'Documents', count: docs.length, content: documentsTab },
    { id: 'factures', label: 'Factures', content: facturesTab },
  ];

  return (
    <div className={`space-y-8 ${customer.isActive ? '' : 'opacity-75'}`}>
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-emerald-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Clients
      </Link>

      <header className="flex items-start justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
            Client
          </div>
          <h1 className="mt-1.5 flex items-baseline gap-3 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">{displayName}</span>
            {tenantTypeLabel && (
              <span className={tenantTypeLabel.cls}>{tenantTypeLabel.text}</span>
            )}
            {!customer.isActive && <span className="badge-neutral">Inactif</span>}
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            {customer.email ?? '—'} · {customer.phone ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/clients/${customer.id}/edit`} className="btn-secondary inline-flex items-center">
            <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Modifier
          </Link>
          <form action={toggleCustomerActiveAction}>
            <input type="hidden" name="id" value={customer.id} />
            <button type="submit" className="btn-secondary">
              {customer.isActive ? 'Désactiver' : 'Réactiver'}
            </button>
          </form>
          <DeleteButton
            action={deleteCustomerAction}
            id={customer.id}
            label="Supprimer"
            confirmationPhrase={displayName}
            description={`Cette action est irréversible. Le client "${displayName}" et ses documents seront supprimés.`}
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

function Kpi({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: number | string;
  variant?: 'default' | 'warn' | 'good';
}) {
  return (
    <div className="card p-5">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div
        className={`mt-2 text-3xl font-medium tabular-nums ${
          variant === 'good'
            ? 'text-emerald-700'
            : variant === 'warn' && value !== 0 && value !== 'Actif'
            ? 'text-zinc-500'
            : 'text-zinc-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
