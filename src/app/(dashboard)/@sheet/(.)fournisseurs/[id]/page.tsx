import { db } from '@/db/client';
import { suppliers, supplierContacts, supplierDocuments } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SheetWrapper } from '@/components/sheet-wrapper';
import { DeleteButton } from '@/components/delete-button';
import { deleteSupplierAction, toggleSupplierActiveAction } from '../../../fournisseurs/actions';
import { Mail, Phone, Pencil } from 'lucide-react';

export const dynamic = 'force-dynamic';

const INVOICING_LABELS: Record<string, string> = {
  pennylane: 'Pennylane',
  email_forward: 'Email',
  scraping_required: 'Scraping requis',
  manual_upload: 'Manuel',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FournisseurSheetPage({ params }: { params: { id: string } }) {
  // Garde : l'intercept [id] capture aussi /fournisseurs/new, /fournisseurs/[uuid]/edit.
  if (!UUID_RE.test(params.id)) return null;

  const rows = await db.select().from(suppliers).where(eq(suppliers.id, params.id)).limit(1);
  if (rows.length === 0) notFound();
  const s = rows[0];

  const [contactsCountRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(supplierContacts)
    .where(eq(supplierContacts.supplierId, s.id));

  const [docsCountRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(supplierDocuments)
    .where(eq(supplierDocuments.supplierId, s.id));

  const displayName =
    s.companyName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() ?? 'Fournisseur';

  return (
    <SheetWrapper key={s.id} fullPageHref={`/fournisseurs/${s.id}`}>
      <div className={s.isActive ? '' : 'opacity-75'}>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Fournisseur
        </div>
        <h1 className="mt-1.5 flex items-baseline gap-3 text-[24px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">{displayName}</span>
          {!s.isActive && <span className="badge-neutral">Inactif</span>}
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500">
          <span className="badge-neutral">
            {INVOICING_LABELS[s.invoicingType] ?? s.invoicingType}
          </span>
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat label="Contacts" value={contactsCountRow.n} />
          <Stat label="Documents" value={docsCountRow.n} />
        </div>

        <div className="mt-6 space-y-3">
          {s.email && (
            <div className="flex items-center gap-2 text-[13px] text-zinc-700">
              <Mail className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.75} />
              {s.email}
            </div>
          )}
          {s.phone && (
            <div className="flex items-center gap-2 text-[13px] text-zinc-700">
              <Phone className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.75} />
              <span className="font-mono">{s.phone}</span>
            </div>
          )}
          {s.address && (
            <div className="text-[13px] text-zinc-600">{s.address}</div>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-zinc-200 pt-6">
          <a
            href={`/fournisseurs/${s.id}/edit`}
            className="btn-secondary inline-flex items-center justify-center"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Modifier
          </a>
          <form action={toggleSupplierActiveAction}>
            <input type="hidden" name="id" value={s.id} />
            <button type="submit" className="btn-secondary w-full">
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
      </div>
    </SheetWrapper>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-medium tabular-nums text-zinc-900">{value}</div>
    </div>
  );
}
