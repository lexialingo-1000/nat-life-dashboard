import { db } from '@/db/client';
import { suppliers, supplierContacts, supplierDocuments, documentTypes } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  addContactAction,
  deleteContactAction,
  deleteSupplierAction,
  uploadSupplierDocumentAction,
  deleteSupplierDocumentAction,
  getSupplierDocumentUrlAction,
} from '../actions';
import { Plus, Mail, Phone, Briefcase, ArrowLeft } from 'lucide-react';
import { DeleteButton } from '@/components/delete-button';
import { ContactDeleteButton } from '@/components/contact-delete-button';
import { DocumentsManager } from '@/components/documents-manager';
import { slugify } from '@/lib/storage/minio';

export const dynamic = 'force-dynamic';

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

  return (
    <div className="space-y-8">
      <Link
        href="/fournisseurs"
        className="inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-amber-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Fournisseurs
      </Link>

      <header className="flex items-start justify-between gap-6">
        <div className="page-header">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-700">
            Fournisseur
          </div>
          <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
            <span className="display-serif">{displayName}</span>
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            {s.address ?? '—'} · {s.email ?? '—'} · {s.phone ?? '—'}
          </p>
        </div>
        <DeleteButton
          action={deleteSupplierAction}
          id={s.id}
          label="Supprimer"
          confirmationPhrase={displayName}
          description={`Cette action est irréversible. Le fournisseur "${displayName}", ses contacts et ses documents seront supprimés.`}
        />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Contacts</h2>
            <span className="text-xs text-slate-400">{contacts.length}</span>
          </div>
          {contacts.length === 0 && (
            <p className="text-sm text-slate-500">Aucun contact</p>
          )}
          <ul className="space-y-2">
            {contacts.map((c) => {
              const contactLabel =
                `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.email || 'contact';
              return (
                <li
                  key={c.id}
                  className="flex items-start justify-between rounded-md border border-slate-100 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—'}
                    </div>
                    {c.function && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Briefcase className="h-3 w-3" />
                        {c.function}
                      </div>
                    )}
                    <div className="mt-1 space-y-0.5 text-xs text-slate-500">
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
            className="mt-4 space-y-2 border-t border-slate-100 pt-4"
          >
            <input type="hidden" name="supplierId" value={s.id} />
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
              Ajouter un contact
            </button>
          </form>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Documents</h2>
            <span className="text-xs text-slate-400">{docs.length}</span>
          </div>
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
      </div>
    </div>
  );
}
