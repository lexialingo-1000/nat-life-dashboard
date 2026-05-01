import { db } from '@/db/client';
import { documentTypes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Save } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { updateDocumentTypeAction } from '../../actions';

export const dynamic = 'force-dynamic';

const SCOPE_LABELS: Record<string, string> = {
  company: 'Société',
  supplier: 'Fournisseur',
  customer: 'Client',
  property: 'Immeuble',
  lot: 'Lot',
  marche: 'Marché',
  marche_lot: 'Sous-lot',
  location: 'Location',
};

export default async function EditDocumentTypePage({ params }: { params: { id: string } }) {
  const rows = await db
    .select()
    .from(documentTypes)
    .where(eq(documentTypes.id, params.id))
    .limit(1);
  if (rows.length === 0) notFound();
  const t = rows[0];
  const isCustomerScope = t.scope === 'customer';

  return (
    <div className="space-y-8">
      <BackLink fallbackHref="/admin/types-documents" label="Types de documents" />

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Administration
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Modifier</span> · {t.label}
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500">
          Code et scope sont verrouillés une fois le type créé pour préserver la cohérence des
          documents existants. Pour changer ces champs, désactive ce type et crée-en un nouveau.
        </p>
      </header>

      <form action={updateDocumentTypeAction} className="card space-y-5 p-6">
        <input type="hidden" name="id" value={t.id} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Code (verrouillé)</label>
            <input
              value={t.code}
              readOnly
              className="input mt-1 font-mono bg-zinc-50 text-zinc-500"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Scope (verrouillé)</label>
            <input
              value={SCOPE_LABELS[t.scope] ?? t.scope}
              readOnly
              className="input mt-1 bg-zinc-50 text-zinc-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Libellé *</label>
          <input
            name="label"
            required
            defaultValue={t.label}
            className="input mt-1"
            placeholder="Attestation Qualibat"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">
              Type de locataire {isCustomerScope ? '' : '(non applicable)'}
            </label>
            <select
              name="appliesToTenantType"
              defaultValue={t.appliesToTenantType ?? ''}
              disabled={!isCustomerScope}
              className="input mt-1 disabled:bg-zinc-50 disabled:text-zinc-400"
            >
              <option value="">— Non applicable / tous —</option>
              <option value="LT">Locataires LT (long terme)</option>
              <option value="CT">Locataires CT (court terme)</option>
              <option value="all">Tous les locataires</option>
            </select>
            {!isCustomerScope && (
              <p className="mt-1 text-[11px] text-zinc-500">
                Réservé aux types scope « Client ».
              </p>
            )}
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">
              Ordre d'affichage
            </label>
            <input
              type="number"
              name="sortOrder"
              defaultValue={t.sortOrder}
              min={0}
              max={9999}
              className="input mt-1 font-mono tnum"
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Plus petit = affiché en premier dans les dropdowns.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="hasExpiration"
              value="on"
              defaultChecked={t.hasExpiration}
              className="h-4 w-4 rounded-sm border-zinc-300 text-zinc-900"
            />
            <span>Avec date d'expiration</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="isRequired"
              value="on"
              defaultChecked={t.isRequired}
              className="h-4 w-4 rounded-sm border-zinc-300 text-zinc-900"
            />
            <span>Obligatoire (widget manquants)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="isActive"
              value="on"
              defaultChecked={t.isActive}
              className="h-4 w-4 rounded-sm border-zinc-300 text-zinc-900"
            />
            <span>Actif</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link href="/admin/types-documents" className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
