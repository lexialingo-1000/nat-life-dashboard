import { db } from '@/db/client';
import { suppliers, supplierContacts, supplierDocuments, documentTypes } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  addContactAction,
  deleteContactAction,
  deleteSupplierAction,
  toggleSupplierActiveAction,
  uploadSupplierDocumentAction,
  deleteSupplierDocumentAction,
  getSupplierDocumentUrlAction,
} from '../actions';
import { Plus, Mail, Phone, Briefcase, ArrowLeft } from 'lucide-react';
import { DeleteButton } from '@/components/delete-button';
import { ContactDeleteButton } from '@/components/contact-delete-button';
import { DocumentsManager } from '@/components/documents-manager';
import { Tabs, type TabItem } from '@/components/tabs';
import { slugify } from '@/lib/storage/minio';

export const dynamic = 'force-dynamic';

const INVOICING_LABELS: Record<string, string> = {
  pennylane: 'Pennylane',
  email_forward: 'Email',
  scraping_required: 'Scraping requis',
  manual_upload: 'Manuel',
};

export default async function FournisseurDetailPage({ params }: { params: { id: string } }) {
  const supplierRow = await db.select().from(suppliers).where(eq(suppliers.id, params.id)).limit(1);
  if (supplierRow.length === 0) notFound();
  const s = supplierRow[0];

  const contacts = await db
    .select()
    .from(supplierContacts)
    .where(eq(supplierContacts.supplierId, s.id))
    .orderBy(asc(supplierContacts.createdAt));

  const docs = await db
    .select({
      id: supplierDocuments.id,
      name: supplierDocuments.name,
      typeLabel: documentTypes.label,
      storageKey: supplierDocuments.storageKey,
      expiresAt: supplierDocuments.expiresAt,
      documentDate: supplierDocuments.documentDate,
      uploadedAt: supplierDocuments.uploadedAt,
    })
    .from(supplierDocuments)
    .innerJoin(documentTypes, eq(supplierDocuments.typeId, documentTypes.id))
    .where(eq(supplierDocuments.supplierId, s.id))
    .orderBy(asc(documentTypes.sortOrder));

  const supplierTypes = await db
    .select({
      id: documentTypes.id,
      label: documentTypes.label,
      hasExpiration: documentTypes.hasExpiration,
    })
    .from(documentTypes)
    .where(and(eq(documentTypes.scope, 'supplier'), eq(documentTypes.isActive, true)))
    .orderBy(asc(documentTypes.sortOrder));

  const displayName =
    s.companyName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() ?? 'Fournisseur';

  const expiringDocsCount = docs.filter((d) => {
    if (!d.expiresAt) return false;
    const days = Math.floor(
      (new Date(d.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days < 30;
  }).length;

  const overviewTab = (
    <div className="grid gap-4 md:grid-cols-4">
      <Kpi
        label="État"
        value={s.isActive ? 'Actif' : 'Inactif'}
        variant={s.isActive ? 'good' : 'warn'}
      />
      <Kpi label="Contacts" value={contacts.length} />
      <Kpi label="Documents" value={docs.length} />
      <Kpi
        label="Docs à renouveler"
        value={expiringDocsCount}
        variant={expiringDocsCount > 0 ? 'warn' : 'default'}
      />
    </div>
  );

  const identityTab = (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-5">
        <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Identité
        </h2>
        <dl className="space-y-2 text-[13px]">
          <Row label="Raison sociale">{s.companyName ?? '—'}</Row>
          <Row label="Prénom">{s.firstName ?? '—'}</Row>
          <Row label="Nom">{s.lastName ?? '—'}</Row>
          <Row label="Adresse">{s.address ?? '—'}</Row>
        </dl>
      </div>
      <div className="card p-5">
        <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Coordonnées & facturation
        </h2>
        <dl className="space-y-2 text-[13px]">
          <Row label="Email">{s.email ?? '—'}</Row>
          <Row label="Téléphone">
            <span className="font-mono">{s.phone ?? '—'}</span>
          </Row>
          <Row label="Mode facturation">
            <span className="badge-neutral">
              {INVOICING_LABELS[s.invoicingType] ?? s.invoicingType}
            </span>
          </Row>
          <Row label="Pennylane ID">
            <span className="font-mono text-[12px]">{s.pennylaneSupplierId ?? '—'}</span>
          </Row>
        </dl>
      </div>
    </div>
  );

  const contactsTab = (
    <div className="card p-6">
      <ul className="space-y-2">
        {contacts.length === 0 && (
          <li className="rounded-md border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500">
            Aucun contact pour l'instant.
          </li>
        )}
        {contacts.map((c) => {
          const contactLabel =
            `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.email || 'contact';
          return (
            <li
              key={c.id}
              className="flex items-start justify-between rounded-md border border-zinc-100 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—'}
                </div>
                {c.function && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                    <Briefcase className="h-3 w-3" />
                    {c.function}
                  </div>
                )}
                <div className="mt-1 space-y-0.5 text-xs text-zinc-500">
                  {c.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {c.email}
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {c.phone}
                    </div>
                  )}
                </div>
              </div>
              <ContactDeleteButton
                action={deleteContactAction}
                contactId={c.id}
                supplierId={s.id}
                contactLabel={contactLabel}
              />
            </li>
          );
        })}
      </ul>

      <form
        key={contacts.length}
        action={addContactAction}
        className="mt-6 space-y-2 border-t border-zinc-100 pt-6"
      >
        <input type="hidden" name="supplierId" value={s.id} />
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Ajouter un contact
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <input name="firstName" placeholder="Prénom" className="input" />
          <input name="lastName" placeholder="Nom" className="input" />
        </div>
        <input name="function" placeholder="Fonction (ex: commercial)" className="input" />
        <div className="grid grid-cols-2 gap-2">
          <input name="email" type="email" placeholder="Email" className="input" />
          <input name="phone" placeholder="Téléphone" className="input" />
        </div>
        <button type="submit" className="btn-secondary w-full">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </button>
      </form>
    </div>
  );

  const documentsTab = (
    <div className="card p-6">
      <DocumentsManager
        scope="suppliers"
        parentId={s.id}
        parentSlug={slugify(displayName)}
        parentIdFieldName="supplierId"
        documents={docs.map((d) => ({
          id: d.id,
          name: d.name,
          typeLabel: d.typeLabel,
          storageKey: d.storageKey,
          documentDate: d.documentDate,
          expiresAt: d.expiresAt,
        }))}
        availableTypes={supplierTypes}
        uploadAction={uploadSupplierDocumentAction}
        deleteAction={deleteSupplierDocumentAction}
        getUrlAction={getSupplierDocumentUrlAction}
      />
    </div>
  );

  const notesTab = (
    <div className="card p-5">
      <p className="whitespace-pre-wrap text-[13px] text-zinc-700">
        {s.notes ?? 'Aucune note.'}
      </p>
    </div>
  );

  const tabs: TabItem[] = [
    { id: 'overview', label: "Vue d'ensemble", content: overviewTab },
    { id: 'identity', label: 'Identité', content: identityTab },
    { id: 'contacts', label: 'Contacts', count: contacts.length, content: contactsTab },
    { id: 'documents', label: 'Documents', count: docs.length, content: documentsTab },
    { id: 'notes', label: 'Notes', content: notesTab },
  ];

  return (
    <div className={`space-y-8 ${s.isActive ? '' : 'opacity-75'}`}>
      <Link
        href="/fournisseurs"
        className="inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-emerald-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Fournisseurs
      </Link>

      <header className="flex items-start justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
            Fournisseur
          </div>
          <h1 className="mt-1.5 flex items-baseline gap-3 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">{displayName}</span>
            {!s.isActive && <span className="badge-neutral">Inactif</span>}
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            {s.address ?? '—'} · {s.email ?? '—'} · {s.phone ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action={toggleSupplierActiveAction}>
            <input type="hidden" name="id" value={s.id} />
            <button type="submit" className="btn-secondary">
              {s.isActive ? 'Désactiver' : 'Réactiver'}
            </button>
          </form>
          <DeleteButton
            action={deleteSupplierAction}
            id={s.id}
            label="Supprimer"
            confirmationPhrase={displayName}
            description={`Cette action est irréversible. Le fournisseur "${displayName}", ses contacts et ses documents seront supprimés.`}
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
