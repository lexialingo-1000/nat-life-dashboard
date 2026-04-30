import { db } from '@/db/client';
import {
  marchesTravaux,
  marcheLotAffectations,
  marcheDocuments,
  lots,
  properties,
  companies,
  suppliers,
  documentTypes,
} from '@/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { DeleteButton } from '@/components/delete-button';
import {
  deleteMarcheAction,
  uploadMarcheDocumentAction,
  deleteMarcheDocumentAction,
  getMarcheDocumentUrlAction,
} from '../actions';
import { Tabs, type TabItem } from '@/components/tabs';
import { DocumentsManager } from '@/components/documents-manager';
import { NotesCard } from '@/components/notes-card';
import { slugify } from '@/lib/storage/minio';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  devis_recu: 'Devis reçu',
  signe: 'Signé',
  en_cours: 'En cours',
  livre: 'Livré',
  conteste: 'Contesté',
  annule: 'Annulé',
};

const STATUS_VARIANT: Record<string, 'good' | 'warn' | 'default'> = {
  devis_recu: 'default',
  signe: 'default',
  en_cours: 'warn',
  livre: 'good',
  conteste: 'warn',
  annule: 'default',
};

export default async function MarcheDetailPage({ params }: { params: { id: string } }) {
  const rows = await db
    .select({
      id: marchesTravaux.id,
      name: marchesTravaux.name,
      description: marchesTravaux.description,
      amountHt: marchesTravaux.amountHt,
      amountTtc: marchesTravaux.amountTtc,
      dateDevis: marchesTravaux.dateDevis,
      dateSignature: marchesTravaux.dateSignature,
      dateDebutPrevu: marchesTravaux.dateDebutPrevu,
      dateFinPrevu: marchesTravaux.dateFinPrevu,
      dateDebutReel: marchesTravaux.dateDebutReel,
      dateFinReelle: marchesTravaux.dateFinReelle,
      status: marchesTravaux.status,
      notes: marchesTravaux.notes,
      propertyId: properties.id,
      propertyName: properties.name,
      companyId: companies.id,
      companyName: companies.name,
      supplierId: suppliers.id,
      supplierName: suppliers.companyName,
      supplierFirstName: suppliers.firstName,
      supplierLastName: suppliers.lastName,
    })
    .from(marchesTravaux)
    .innerJoin(properties, eq(marchesTravaux.propertyId, properties.id))
    .innerJoin(companies, eq(properties.companyId, companies.id))
    .innerJoin(suppliers, eq(marchesTravaux.supplierId, suppliers.id))
    .where(eq(marchesTravaux.id, params.id))
    .limit(1);

  if (rows.length === 0) notFound();
  const marche = rows[0];

  const affectedLots = await db
    .select({ id: lots.id, name: lots.name })
    .from(marcheLotAffectations)
    .innerJoin(lots, eq(lots.id, marcheLotAffectations.lotId))
    .where(eq(marcheLotAffectations.marcheId, marche.id))
    .orderBy(asc(lots.name));

  const docs = await db
    .select({
      id: marcheDocuments.id,
      name: marcheDocuments.name,
      typeLabel: documentTypes.label,
      storageKey: marcheDocuments.storageKey,
      expiresAt: marcheDocuments.expiresAt,
      documentDate: marcheDocuments.documentDate,
    })
    .from(marcheDocuments)
    .innerJoin(documentTypes, eq(marcheDocuments.typeId, documentTypes.id))
    .where(eq(marcheDocuments.marcheId, marche.id))
    .orderBy(asc(documentTypes.sortOrder));

  const marcheDocTypes = await db
    .select({
      id: documentTypes.id,
      label: documentTypes.label,
      hasExpiration: documentTypes.hasExpiration,
    })
    .from(documentTypes)
    .where(and(eq(documentTypes.scope, 'marche'), eq(documentTypes.isActive, true)))
    .orderBy(asc(documentTypes.sortOrder));

  const supplierLabel =
    marche.supplierName ??
    `${marche.supplierFirstName ?? ''} ${marche.supplierLastName ?? ''}`.trim() ??
    '—';

  const overviewTab = (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi
          label="Montant HT"
          value={
            marche.amountHt
              ? `${Number(marche.amountHt).toLocaleString('fr-FR')} €`
              : '—'
          }
        />
        <Kpi label="Lots concernés" value={affectedLots.length || 'communs'} />
        <Kpi
          label="Statut"
          value={STATUS_LABELS[marche.status] ?? marche.status}
          variant={STATUS_VARIANT[marche.status] ?? 'default'}
        />
      </div>
      <NotesCard notes={marche.notes} />
    </div>
  );

  const identityTab = (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-5">
        <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Identité
        </h2>
        <dl className="space-y-2 text-[13px]">
          <Row label="Nom">{marche.name}</Row>
          <Row label="Bien">
            <Link
              href={`/biens/properties/${marche.propertyId}`}
              className="hover:text-emerald-700"
            >
              {marche.propertyName}
            </Link>
          </Row>
          <Row label="Fournisseur">
            <Link
              href={`/fournisseurs/${marche.supplierId}`}
              className="hover:text-emerald-700"
            >
              {supplierLabel}
            </Link>
          </Row>
          <Row label="Description">{marche.description ?? '—'}</Row>
        </dl>
      </div>
      <div className="card p-5">
        <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Montants & dates
        </h2>
        <dl className="space-y-2 text-[13px]">
          <Row label="HT">
            <span className="tnum">
              {marche.amountHt
                ? `${Number(marche.amountHt).toLocaleString('fr-FR')} €`
                : '—'}
            </span>
          </Row>
          <Row label="TTC">
            <span className="tnum">
              {marche.amountTtc
                ? `${Number(marche.amountTtc).toLocaleString('fr-FR')} €`
                : '—'}
            </span>
          </Row>
          <Row label="Date devis">{marche.dateDevis ?? '—'}</Row>
          <Row label="Date signature">{marche.dateSignature ?? '—'}</Row>
          <Row label="Début prévu">{marche.dateDebutPrevu ?? '—'}</Row>
          <Row label="Fin prévue">{marche.dateFinPrevu ?? '—'}</Row>
          <Row label="Début réel">{marche.dateDebutReel ?? '—'}</Row>
          <Row label="Fin réelle">{marche.dateFinReelle ?? '—'}</Row>
        </dl>
      </div>
    </div>
  );

  const lotsTab = (
    <div className="card p-6">
      {affectedLots.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Aucun lot affecté — marché de parties communes / structurel (toiture, façade,
          ascenseur, etc.).
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {affectedLots.map((l) => (
            <li key={l.id}>
              <Link
                href={`/biens/lots/${l.id}`}
                className="rounded-full border border-zinc-200 bg-[#fbf8f0] px-3 py-1.5 text-sm hover:bg-zinc-50 hover:text-emerald-700"
              >
                {l.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const documentsTab = (
    <div className="card p-6">
      <DocumentsManager
        scope="marches"
        parentId={marche.id}
        parentSlug={slugify(marche.name)}
        parentIdFieldName="marcheId"
        documents={docs.map((d) => ({
          id: d.id,
          name: d.name,
          typeLabel: d.typeLabel,
          storageKey: d.storageKey,
          documentDate: d.documentDate,
          expiresAt: d.expiresAt,
        }))}
        availableTypes={marcheDocTypes}
        uploadAction={uploadMarcheDocumentAction}
        deleteAction={deleteMarcheDocumentAction}
        getUrlAction={getMarcheDocumentUrlAction}
      />
    </div>
  );

  const tabs: TabItem[] = [
    { id: 'overview', label: "Vue d'ensemble", content: overviewTab },
    { id: 'identity', label: 'Identité', content: identityTab },
    {
      id: 'lots',
      label: 'Lots concernés',
      count: affectedLots.length || undefined,
      content: lotsTab,
    },
    { id: 'documents', label: 'Documents', count: docs.length, content: documentsTab },
  ];

  return (
    <div className="space-y-8">
      <Link
        href="/marches"
        className="inline-flex items-center text-sm text-zinc-500 hover:text-emerald-700"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Marchés de travaux
      </Link>

      <header className="flex items-start justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
            <Link href={`/societes/${marche.companyId}`} className="hover:text-emerald-800">
              {marche.companyName}
            </Link>{' '}
            ·{' '}
            <Link
              href={`/biens/properties/${marche.propertyId}`}
              className="hover:text-emerald-800"
            >
              {marche.propertyName}
            </Link>
          </div>
          <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">{marche.name}</span>
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            Fournisseur :{' '}
            <Link
              href={`/fournisseurs/${marche.supplierId}`}
              className="font-medium hover:underline"
            >
              {supplierLabel}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/marches/${marche.id}/edit`} className="btn-secondary">
            <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Modifier
          </Link>
          <DeleteButton
            action={deleteMarcheAction}
            id={marche.id}
            label="Supprimer"
            confirmationPhrase={marche.name}
            description={`Cette action est irréversible. Le marché "${marche.name}" sera supprimé. Les sous-lots techniques et documents associés seront aussi supprimés.`}
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
  variant?: 'default' | 'good' | 'warn';
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
            : variant === 'warn'
            ? 'text-emerald-700'
            : 'text-zinc-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
