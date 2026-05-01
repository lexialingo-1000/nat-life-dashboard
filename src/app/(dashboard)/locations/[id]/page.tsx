import { db } from '@/db/client';
import {
  locations,
  locationDocuments,
  documentTypes,
  lots,
  properties,
  customers,
} from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { SectionTitle } from '@/components/section-title';
import { DocumentsManager } from '@/components/documents-manager';
import { NotesCard } from '@/components/notes-card';
import { Tabs, type TabItem } from '@/components/tabs';
import { DeleteButton } from '@/components/delete-button';
import {
  deleteLocationAction,
  uploadLocationDocumentAction,
  deleteLocationDocumentAction,
  getLocationDocumentUrlAction,
} from '../actions';
import { slugify } from '@/lib/storage/minio';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
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

type LocStatus = 'actif' | 'a_venir' | 'inactif';

function computeStatus(dateDebut: string, dateFin: string | null): LocStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const debut = new Date(dateDebut);
  if (dateFin && new Date(dateFin) < today) return 'inactif';
  if (debut > today) return 'a_venir';
  return 'actif';
}

const STATUS_LABELS: Record<LocStatus, string> = {
  actif: 'Actif',
  a_venir: 'À venir',
  inactif: 'Inactif',
};

const STATUS_BADGE: Record<LocStatus, string> = {
  actif: 'badge-emerald',
  a_venir: 'badge-blue',
  inactif: 'badge-neutral',
};

export default async function LocationDetailPage({ params }: { params: { id: string } }) {
  const rows = await db
    .select({
      id: locations.id,
      typeLocation: locations.typeLocation,
      dateDebut: locations.dateDebut,
      dateFin: locations.dateFin,
      prixLocation: locations.prixLocation,
      depotGarantie: locations.depotGarantie,
      chargesCourantes: locations.chargesCourantes,
      fraisMenage: locations.fraisMenage,
      taxeSejour: locations.taxeSejour,
      periodicite: locations.periodicite,
      notes: locations.notes,
      lotId: lots.id,
      lotName: lots.name,
      propertyId: properties.id,
      propertyName: properties.name,
      customerId: customers.id,
      customerCompanyName: customers.companyName,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerEmail: customers.email,
      customerPhone: customers.phone,
    })
    .from(locations)
    .innerJoin(lots, eq(lots.id, locations.lotId))
    .innerJoin(properties, eq(properties.id, lots.propertyId))
    .innerJoin(customers, eq(customers.id, locations.customerId))
    .where(eq(locations.id, params.id))
    .limit(1);

  if (rows.length === 0) notFound();
  const loc = rows[0];

  const customerLabel =
    loc.customerCompanyName ||
    `${loc.customerFirstName ?? ''} ${loc.customerLastName ?? ''}`.trim() ||
    'locataire';

  const status = computeStatus(loc.dateDebut, loc.dateFin);

  const docs = await db
    .select({
      id: locationDocuments.id,
      name: locationDocuments.name,
      typeLabel: documentTypes.label,
      storageKey: locationDocuments.storageKey,
      expiresAt: locationDocuments.expiresAt,
      documentDate: locationDocuments.documentDate,
      uploadedAt: locationDocuments.uploadedAt,
    })
    .from(locationDocuments)
    .innerJoin(documentTypes, eq(locationDocuments.typeId, documentTypes.id))
    .where(eq(locationDocuments.locationId, loc.id))
    .orderBy(asc(documentTypes.sortOrder));

  const locationDocTypes = await db
    .select({
      id: documentTypes.id,
      label: documentTypes.label,
      hasExpiration: documentTypes.hasExpiration,
    })
    .from(documentTypes)
    .where(and(eq(documentTypes.scope, 'location'), eq(documentTypes.isActive, true)))
    .orderBy(asc(documentTypes.sortOrder));

  const fmtMoney = (v: string | null, suffix = '') =>
    v ? `${Number(v).toLocaleString('fr-FR')} €${suffix ? ' ' + suffix : ''}` : '—';

  const periodSuffix = PERIODICITE_LABELS[loc.periodicite] ?? '';

  const overviewTab = (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi
          label="Loyer"
          value={fmtMoney(loc.prixLocation, periodSuffix)}
          variant={loc.prixLocation ? 'good' : 'default'}
        />
        <Kpi label="Dépôt de garantie" value={fmtMoney(loc.depotGarantie)} />
        <Kpi
          label="Statut"
          value={STATUS_LABELS[status]}
          variant={status === 'actif' ? 'good' : status === 'inactif' ? 'warn' : 'default'}
        />
      </div>

      <div className="card p-5">
        <SectionTitle>Détails</SectionTitle>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
          <Row label="Type">
            <span className="badge-neutral">
              {TYPE_LABELS[loc.typeLocation] ?? loc.typeLocation}
            </span>
          </Row>
          <Row label="Périodicité">
            <span className="badge-neutral">{loc.periodicite}</span>
          </Row>
          <Row label="Date de début">{formatDate(loc.dateDebut)}</Row>
          <Row label="Date de fin">
            {loc.dateFin ? formatDate(loc.dateFin) : <span className="italic text-zinc-400">en cours</span>}
          </Row>
          <Row label="Bien">
            <Link href={`/biens/properties/${loc.propertyId}`} className="link-cell-soft">
              {loc.propertyName}
            </Link>
          </Row>
          <Row label="Lot">
            <Link href={`/biens/lots/${loc.lotId}`} className="link-cell-soft">
              {loc.lotName}
            </Link>
          </Row>
          <Row label="Locataire">
            <Link href={`/clients/${loc.customerId}`} className="link-cell-soft">
              {customerLabel}
            </Link>
          </Row>
          <Row label="Contact">
            <span className="text-zinc-600">
              {loc.customerEmail ?? '—'}
              {loc.customerPhone ? ` · ${loc.customerPhone}` : ''}
            </span>
          </Row>
        </dl>
      </div>

      <div className="card p-5">
        <SectionTitle>Charges</SectionTitle>
        <dl className="grid grid-cols-3 gap-4 text-[13px]">
          <Row label="Charges courantes">
            <span className="tnum">{fmtMoney(loc.chargesCourantes)}</span>
          </Row>
          <Row label="Frais ménage">
            <span className="tnum">{fmtMoney(loc.fraisMenage)}</span>
          </Row>
          <Row label="Taxe séjour">
            <span className="tnum">{fmtMoney(loc.taxeSejour)}</span>
          </Row>
        </dl>
      </div>

      <NotesCard notes={loc.notes} />
    </div>
  );

  const documentsTab = (
    <div className="card p-6">
      <DocumentsManager
        scope="locations"
        parentId={loc.id}
        parentSlug={slugify(`${loc.propertyName}-${loc.lotName}-${customerLabel}`)}
        parentIdFieldName="locationId"
        documents={docs.map((d) => ({
          id: d.id,
          name: d.name,
          typeLabel: d.typeLabel,
          storageKey: d.storageKey,
          documentDate: d.documentDate,
          expiresAt: d.expiresAt,
          uploadedAt: d.uploadedAt instanceof Date ? d.uploadedAt.toISOString() : String(d.uploadedAt),
        }))}
        availableTypes={locationDocTypes}
        uploadAction={uploadLocationDocumentAction}
        deleteAction={deleteLocationDocumentAction}
        getUrlAction={getLocationDocumentUrlAction}
      />
    </div>
  );

  const tabs: TabItem[] = [
    { id: 'overview', label: "Vue d'ensemble", content: overviewTab },
    { id: 'documents', label: 'Documents', count: docs.length, content: documentsTab },
  ];

  return (
    <div className="space-y-8">
      <BackLink fallbackHref="/locations" label="Locations" />

      <header className="flex items-start justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
            Location
          </div>
          <h1 className="mt-1.5 flex items-baseline gap-3 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">{customerLabel}</span>
            <span className={STATUS_BADGE[status]}>{STATUS_LABELS[status]}</span>
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            <Link
              href={`/biens/properties/${loc.propertyId}`}
              className="uppercase tracking-[0.04em] hover:text-emerald-700"
            >
              {loc.propertyName}
            </Link>
            {' · '}
            <Link href={`/biens/lots/${loc.lotId}`} className="hover:text-emerald-700">
              {loc.lotName}
            </Link>
            {' · '}
            {formatDate(loc.dateDebut)}
            {loc.dateFin ? ` → ${formatDate(loc.dateFin)}` : ' → en cours'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/locations/${loc.id}/edit`}
            className="btn-secondary inline-flex items-center"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Modifier
          </Link>
          <DeleteButton
            action={deleteLocationAction}
            id={loc.id}
            label="Supprimer"
            confirmationPhrase={customerLabel}
            description={`Cette action est irréversible. La location de "${customerLabel}" sur ${loc.propertyName} · ${loc.lotName} et ses documents associés seront supprimés.`}
            extraFields={{ returnTo: '/locations' }}
          />
        </div>
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
        className={`mt-2 text-2xl font-medium tabular-nums ${
          variant === 'good'
            ? 'text-emerald-700'
            : variant === 'warn'
            ? 'text-zinc-500'
            : 'text-zinc-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
