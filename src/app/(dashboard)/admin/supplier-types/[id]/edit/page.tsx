import { db } from '@/db/client';
import { supplierTypes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Save } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { DeleteButton } from '@/components/delete-button';
import { updateSupplierTypeAction, deleteSupplierTypeAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditSupplierTypePage({ params }: { params: { id: string } }) {
  const rows = await db
    .select()
    .from(supplierTypes)
    .where(eq(supplierTypes.id, params.id))
    .limit(1);
  if (rows.length === 0) notFound();
  const t = rows[0];

  return (
    <div className="space-y-8">
      <BackLink fallbackHref="/admin/supplier-types" label="Types de fournisseurs" />

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
          Administration · Paramètres
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Modifier</span> · {t.label}
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500">
          Le code est verrouillé une fois le type créé. Pour le changer, désactive ce type et
          crée-en un nouveau.
        </p>
      </header>

      <form action={updateSupplierTypeAction} className="card space-y-5 p-6">
        <input type="hidden" name="id" value={t.id} />

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Code (verrouillé)</label>
          <input
            value={t.code}
            readOnly
            className="input mt-1 font-mono bg-zinc-50 text-zinc-500"
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Libellé *</label>
          <input
            name="label"
            required
            defaultValue={t.label}
            className="input mt-1"
            placeholder="Notaire"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Ordre</label>
            <input
              name="sortOrder"
              type="number"
              min="0"
              max="9999"
              defaultValue={t.sortOrder}
              className="input mt-1 tnum"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-[13px]">
            <input
              type="checkbox"
              name="isActive"
              value="on"
              defaultChecked={t.isActive}
              className="h-4 w-4 rounded-sm border-zinc-300 text-zinc-900"
            />
            <span>Type actif</span>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <DeleteButton
            action={deleteSupplierTypeAction}
            id={t.id}
            label="Supprimer ce type"
            confirmationPhrase={t.label}
            description={`Supprimer le type "${t.label}" ? Refusé si utilisé par au moins un fournisseur ou type de document.`}
          />
          <div className="flex gap-3">
            <Link href="/admin/supplier-types" className="btn-secondary">
              Annuler
            </Link>
            <button type="submit" className="btn-primary">
              <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
              Enregistrer
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
