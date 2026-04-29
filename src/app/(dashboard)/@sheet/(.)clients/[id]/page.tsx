import { db } from '@/db/client';
import { customers, customerDocuments } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SheetWrapper } from '@/components/sheet-wrapper';
import { DeleteButton } from '@/components/delete-button';
import { deleteCustomerAction, toggleCustomerActiveAction } from '../../../clients/actions';
import { Mail, Phone, Pencil } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ClientSheetPage({ params }: { params: { id: string } }) {
  const rows = await db.select().from(customers).where(eq(customers.id, params.id)).limit(1);
  if (rows.length === 0) notFound();
  const c = rows[0];

  const [docsCountRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(customerDocuments)
    .where(eq(customerDocuments.customerId, c.id));

  const displayName =
    c.companyName ?? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ?? 'Client';

  return (
    <SheetWrapper key={c.id} fullPageHref={`/clients/${c.id}`}>
      <div className={c.isActive ? '' : 'opacity-75'}>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Client
        </div>
        <h1 className="mt-1.5 flex items-baseline gap-3 text-[24px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">{displayName}</span>
          {!c.isActive && <span className="badge-neutral">Inactif</span>}
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat label="Documents" value={docsCountRow.n} />
          <Stat label="Locations" value="—" />
        </div>

        <div className="mt-6 space-y-3">
          {c.email && (
            <div className="flex items-center gap-2 text-[13px] text-zinc-700">
              <Mail className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.75} />
              {c.email}
            </div>
          )}
          {c.phone && (
            <div className="flex items-center gap-2 text-[13px] text-zinc-700">
              <Phone className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.75} />
              <span className="font-mono">{c.phone}</span>
            </div>
          )}
          {c.address && (
            <div className="text-[13px] text-zinc-600">{c.address}</div>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-zinc-200 pt-6">
          <a
            href={`/clients/${c.id}/edit`}
            className="btn-secondary inline-flex items-center justify-center"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Modifier
          </a>
          <form action={toggleCustomerActiveAction}>
            <input type="hidden" name="id" value={c.id} />
            <button type="submit" className="btn-secondary w-full">
              {c.isActive ? 'Désactiver' : 'Réactiver'}
            </button>
          </form>
          <DeleteButton
            action={deleteCustomerAction}
            id={c.id}
            label="Supprimer"
            confirmationPhrase={displayName}
            description={`Cette action est irréversible. Le client "${displayName}" et ses documents seront supprimés.`}
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
