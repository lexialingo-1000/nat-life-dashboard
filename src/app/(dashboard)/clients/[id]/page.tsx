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

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center text-sm text-slate-600 hover:underline">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Clients
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {customer.email ?? '—'} · {customer.phone ?? '—'}
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold">Informations</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div className="md:col-span-2">
            <dt className="text-xs uppercase text-slate-500">Adresse</dt>
            <dd className="mt-1">{customer.address ?? '—'}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-xs uppercase text-slate-500">Notes</dt>
            <dd className="mt-1 whitespace-pre-wrap">{customer.notes ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Documents</h2>
          <span className="text-xs text-slate-400">{docs.length}</span>
        </div>
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
    </div>
  );
}
