import { db } from '@/db/client';
import { companies, properties, lots, companyDocuments, documentTypes } from '@/db/schema';
import { eq, sql, asc, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { SectionTitle } from '@/components/section-title';
import { DeleteButton } from '@/components/delete-button';
import {
  deleteSocieteAction,
  uploadCompanyDocumentAction,
  deleteCompanyDocumentAction,
  getCompanyDocumentUrlAction,
} from '../actions';
import { Tabs, type TabItem } from '@/components/tabs';
import { DocumentsManager } from '@/components/documents-manager';
import { slugify } from '@/lib/storage/minio';

export const dynamic = 'force-dynamic';

export default async function SocieteDetailPage({ params }: { params: { id: string } }) {
  let company: any = null;
  let props: any[] = [];
  let totalLots = 0;
  let dbError: string | null = null;
  try {
    const rows = await db.select().from(companies).where(eq(companies.id, params.id)).limit(1);
    if (rows.length === 0) notFound();
    company = rows[0];

    props = await db
      .select({
        id: properties.id,
        name: properties.name,
        type: properties.type,
        address: properties.address,
        lotsCount: sql<number>`(SELECT count(*)::int FROM "lots" WHERE "lots"."property_id" = "properties"."id")`,
      })
      .from(properties)
      .where(eq(properties.companyId, company.id))
      .orderBy(asc(properties.name));

    if (company.id) {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(lots)
        .innerJoin(properties, eq(lots.propertyId, properties.id))
        .where(eq(properties.companyId, company.id));
      totalLots = n ?? 0;
    }
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  if (!company) {
    return (
      <div className="card p-6 text-sm text-emerald-700">
        Connexion DB indisponible : {dbError}
      </div>
    );
  }

  const docs = await db
    .select({
      id: companyDocuments.id,
      name: companyDocuments.name,
      typeLabel: documentTypes.label,
      storageKey: companyDocuments.storageKey,
      expiresAt: companyDocuments.expiresAt,
      documentDate: companyDocuments.documentDate,
      uploadedAt: companyDocuments.uploadedAt,
    })
    .from(companyDocuments)
    .innerJoin(documentTypes, eq(companyDocuments.typeId, documentTypes.id))
    .where(eq(companyDocuments.companyId, company.id))
    .orderBy(asc(documentTypes.sortOrder));

  const companyDocTypes = await db
    .select({
      id: documentTypes.id,
      label: documentTypes.label,
      hasExpiration: documentTypes.hasExpiration,
    })
    .from(documentTypes)
    .where(and(eq(documentTypes.scope, 'company'), eq(documentTypes.isActive, true)))
    .orderBy(asc(documentTypes.sortOrder));

  const isActive = company.isActive ?? true;

  const overviewTab = (
    <div className="grid gap-4 md:grid-cols-3">
      <Kpi label="Biens immobiliers" value={props.length} />
      <Kpi label="Lots (total)" value={totalLots} />
      <Kpi
        label="État"
        value={isActive ? 'Active' : 'Inactive'}
        variant={isActive ? 'good' : 'warn'}
      />
    </div>
  );

  const identityTab = (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-5">
        <SectionTitle>Identité juridique</SectionTitle>
        <dl className="space-y-2 text-[13px]">
          <Row label="Nom">{company.name}</Row>
          <Row label="Type">
            <span className={company.type === 'commerciale' ? 'badge-blue' : 'badge-emerald'}>
              {company.type === 'commerciale' ? 'Commerciale' : 'Immobilière'}
            </span>
          </Row>
          <Row label="Forme juridique">
            <span className="badge-neutral">{company.formeJuridique ?? '—'}</span>
          </Row>
          <Row label="SIREN">
            <span className="font-mono tnum">{company.siren ?? '—'}</span>
          </Row>
        </dl>
      </div>
      <div className="card p-5">
        <SectionTitle>Activité &amp; siège</SectionTitle>
        <dl className="space-y-2 text-[13px]">
          <Row label="Activité principale">{company.activitePrincipale ?? '—'}</Row>
          <Row label="Code NAF">
            <span className="font-mono">{company.nafCode ?? '—'}</span>
          </Row>
          <Row label="Adresse siège">{company.address ?? '—'}</Row>
        </dl>
      </div>
    </div>
  );

  const biensTab = (
    <div className="card overflow-hidden">
      {props.length === 0 ? (
        <p className="p-6 text-center text-sm text-zinc-500">
          {company.type === 'immobiliere'
            ? 'Aucun bien rattaché à cette société.'
            : 'Société commerciale — pas de biens immobiliers.'}
        </p>
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>Nom</th>
              <th className="w-[120px]">Type</th>
              <th>Adresse</th>
              <th className="w-[80px]">Lots</th>
            </tr>
          </thead>
          <tbody>
            {props.map((p, i) => (
              <tr key={p.id} className={i % 2 === 1 ? 'bg-zinc-50/40' : undefined}>
                <td>
                  <Link href={`/biens/properties/${p.id}`} className="link-cell">
                    {p.name}
                  </Link>
                </td>
                <td>
                  <span className="badge-neutral">{p.type}</span>
                </td>
                <td className="text-[12px] text-zinc-500">{p.address ?? '—'}</td>
                <td className="tabular-nums">{p.lotsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const documentsTab = (
    <div className="card p-6">
      <DocumentsManager
        scope="companies"
        parentId={company.id}
        parentSlug={slugify(company.name)}
        parentIdFieldName="companyId"
        documents={docs.map((d) => ({
          id: d.id,
          name: d.name,
          typeLabel: d.typeLabel,
          storageKey: d.storageKey,
          documentDate: d.documentDate,
          expiresAt: d.expiresAt,
          uploadedAt: d.uploadedAt instanceof Date ? d.uploadedAt.toISOString() : String(d.uploadedAt),
        }))}
        availableTypes={companyDocTypes}
        uploadAction={uploadCompanyDocumentAction}
        deleteAction={deleteCompanyDocumentAction}
        getUrlAction={getCompanyDocumentUrlAction}
      />
    </div>
  );

  const tabs: TabItem[] = [
    { id: 'overview', label: "Vue d'ensemble", content: overviewTab },
    { id: 'identity', label: 'Identité', content: identityTab },
    { id: 'biens', label: 'Biens', count: props.length, content: biensTab },
    { id: 'documents', label: 'Documents', count: docs.length, content: documentsTab },
  ];

  return (
    <div className={`space-y-8 ${isActive ? '' : 'opacity-75'}`}>
      <BackLink fallbackHref="/societes" label="Sociétés" />

      <header className="flex items-start justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
            Société {!isActive && <span className="ml-2 badge-neutral">Inactive</span>}
          </div>
          <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">{company.name}</span>
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            {company.type} · <span className="uppercase">{company.formeJuridique ?? '—'}</span> ·
            SIREN <span className="font-mono">{company.siren ?? '—'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/societes/${company.id}/edit`} className="btn-secondary">
            <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Modifier
          </Link>
          <DeleteButton
            action={deleteSocieteAction}
            id={company.id}
            label="Supprimer"
            confirmationPhrase={company.name}
            description={`Cette action est irréversible. La société "${company.name}" sera supprimée. Les biens immobiliers rattachés seront orphelins (à réaffecter).`}
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
