import { db } from '@/db/client';
import { customers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { updateCustomerAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const rows = await db.select().from(customers).where(eq(customers.id, params.id)).limit(1);
  if (rows.length === 0) notFound();
  const c = rows[0];
  const displayName =
    c.companyName ?? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ?? 'Client';

  return (
    <div className="max-w-2xl space-y-8">
      <Link
        href={`/clients/${c.id}`}
        className="inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-emerald-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {displayName}
      </Link>

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Référentiel
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Modifier le client</span>
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500">
          Mettre à jour les informations générales. Les documents se gèrent depuis la fiche.
        </p>
      </header>

      <form action={updateCustomerAction} className="card space-y-4 p-6">
        <input type="hidden" name="id" value={c.id} />

        <div>
          <label className="block text-sm font-medium">Raison sociale</label>
          <input name="companyName" defaultValue={c.companyName ?? ''} className="input mt-1" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Prénom</label>
            <input name="firstName" defaultValue={c.firstName ?? ''} className="input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-medium">Nom</label>
            <input name="lastName" defaultValue={c.lastName ?? ''} className="input mt-1" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Adresse</label>
          <input name="address" defaultValue={c.address ?? ''} className="input mt-1" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              name="email"
              type="email"
              defaultValue={c.email ?? ''}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Téléphone</label>
            <input name="phone" defaultValue={c.phone ?? ''} className="input mt-1" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Notes</label>
          <textarea
            name="notes"
            defaultValue={c.notes ?? ''}
            rows={3}
            className="input mt-1"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </div>

        <div className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <input
            type="checkbox"
            id="isActive"
            name="isActive"
            defaultChecked={c.isActive}
            className="h-4 w-4 rounded border-zinc-300"
          />
          <label htmlFor="isActive" className="text-sm">
            Client actif
            <span className="ml-2 text-xs text-zinc-500">
              (décocher pour archiver sans supprimer)
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href={`/clients/${c.id}`} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
