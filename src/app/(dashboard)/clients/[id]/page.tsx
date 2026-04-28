import { db } from '@/db/client';
import { customers, customerDocuments, documentTypes } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  uploadCustomerDocumentAction,
  deleteCustomerDocumentAction,
  getCustomerDocumentUrlAction,
} from '../actions';
import { DocumentsManager } from '@/components/documents-manager';
import { Tabs, type TabItem } from '@/components/tabs';
import { slugify } from '@/lib/storage/minio';

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

  const customerTypes = await db
    .select({
      id: documentTypes.id,
      label: documentTypes.label,
      hasExpiration: documentTypes.hasExpiration,
    })
    .from(documentTypes)
    .where(and(eq(documentTypes.scope, 'customer'), eq(documentTypes.isActive, true)))
    .orderBy(asc(documentTypes.sortOrder));

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

  const overviewTab = (
    <div className="grid gap-4 md:grid-cols-3">
      <Kpi label="Documents" value={docs.length} />
      <Kpi
        label="Docs à renouveler"
        value={expiringDocsCount}
        variant={expiringDocsCount > 0 ? 'warn' : 'default'}
      />
      <Kpi label="Locations" value="—" />
    </div>
  );

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
        }))}
        availableTypes={customerTypes}
        uploadAction={uploadCustomerDocumentAction}
        deleteAction={deleteCustomerDocumentAction}
        getUrlAction={getCustomerDocumentUrlAction}
      />
    </div>
  );

  const notesTab = (
    <div className="card p-5">
      <p className="whitespace-pre-wrap text-[13px] text-zinc-700">
        {customer.notes ?? 'Aucune note.'}
      </p>
    </div>
  );

  const tabs: TabItem[] = [
    { id: 'overview', label: "Vue d'ensemble", content: overviewTab },
    { id: 'identity', label: 'Identité', content: identityTab },
    { id: 'documents', label: 'Documents', count: docs.length, content: documentsTab },
    { id: 'notes', label: 'Notes', content: notesTab },
  ];

  return (
    <div className="space-y-8">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-emerald-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Clients
      </Link>

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Client
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">{displayName}</span>
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500">
          {customer.email ?? '—'} · {customer.phone ?? '—'}
        </p>
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
  variant?: 'default' | 'warn';
}) {
  return (
    <div className="card p-5">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div
        className={`mt-2 text-3xl font-medium tabular-nums ${
          variant === 'warn' && value !== 0 ? 'text-emerald-700' : 'text-zinc-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
