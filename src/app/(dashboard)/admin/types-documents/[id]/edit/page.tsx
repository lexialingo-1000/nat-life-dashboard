import { db } from '@/db/client';
import { documentTypes, documentCategories, supplierTypes } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Save } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { DeleteButton } from '@/components/delete-button';
import { updateDocumentTypeAction, deleteDocumentTypeAction } from '../../actions';

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

// dashboard-22 #8b — options type de société (enum company_type).
const COMPANY_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'commerciale_bilan', label: 'Commerciale (bilan)' },
  { value: 'commerciale_sans_bilan', label: 'Commerciale (sans bilan)' },
  { value: 'immobiliere_bilan', label: 'Immobilière (bilan)' },
  { value: 'immobiliere_sans_bilan', label: 'Immobilière (sans bilan)' },
];

export default async function EditDocumentTypePage({ params }: { params: { id: string } }) {
  const rows = await db
    .select()
    .from(documentTypes)
    .where(eq(documentTypes.id, params.id))
    .limit(1);
  if (rows.length === 0) notFound();
  const t = rows[0];
  const isCustomerScope = t.scope === 'customer';
  const isSupplierScope = t.scope === 'supplier';
  const isCompanyScope = t.scope === 'company';

  const categories = await db
    .select({ id: documentCategories.id, label: documentCategories.label })
    .from(documentCategories)
    .where(eq(documentCategories.isActive, true))
    .orderBy(asc(documentCategories.sortOrder), asc(documentCategories.label));
  const supplierTypeOptions = await db
    .select({ id: supplierTypes.id, label: supplierTypes.label })
    .from(supplierTypes)
    .where(eq(supplierTypes.isActive, true))
    .orderBy(asc(supplierTypes.sortOrder), asc(supplierTypes.label));

  return (
    <div className="space-y-8">
      <BackLink fallbackHref="/admin/types-documents" label="Types de documents" />

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
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
            <label className="block text-[12px] font-medium text-zinc-700">
              Scope (verrouillé)
            </label>
            <input
              value={SCOPE_LABELS[t.scope] ?? t.scope}
              readOnly
              className="input mt-1 bg-zinc-50 text-zinc-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">
              Catégorie (regroupement transversal)
            </label>
            <select name="categoryId" defaultValue={t.categoryId ?? ''} className="input mt-1">
              <option value="">— Aucune —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-zinc-500">
              Paramétrable via{' '}
              <span className="font-mono">Paramètres → Catégories de documents</span>.
            </p>
          </div>
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
              <p className="mt-1 text-[11px] text-zinc-500">Réservé aux types scope « Client ».</p>
            )}
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">
              Type de fournisseur {isSupplierScope ? '' : '(non applicable)'}
            </label>
            <select
              name="supplierTypeId"
              defaultValue={t.supplierTypeId ?? ''}
              disabled={!isSupplierScope}
              className="input mt-1 disabled:bg-zinc-50 disabled:text-zinc-400"
            >
              <option value="">— Tous les fournisseurs —</option>
              {supplierTypeOptions.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
            {!isSupplierScope && (
              <p className="mt-1 text-[11px] text-zinc-500">
                Réservé aux types scope « Fournisseur ».
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">
              Type de société {isCompanyScope ? '' : '(non applicable)'}
            </label>
            <select
              name="appliesToCompanyType"
              defaultValue={t.appliesToCompanyType ?? ''}
              disabled={!isCompanyScope}
              className="input mt-1 disabled:bg-zinc-50 disabled:text-zinc-400"
            >
              <option value="">— Toutes les sociétés —</option>
              {COMPANY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {!isCompanyScope ? (
              <p className="mt-1 text-[11px] text-zinc-500">Réservé aux types scope « Société ».</p>
            ) : (
              <p className="mt-1 text-[11px] text-zinc-500">
                Si défini, ce type s'applique uniquement aux sociétés de ce type.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Ordre d'affichage</label>
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

        <div className="flex items-center justify-between gap-3 pt-2">
          <DeleteButton
            action={deleteDocumentTypeAction}
            id={t.id}
            label="Supprimer ce type"
            confirmationPhrase={t.label}
            description={`Supprimer le type de document "${t.label}" ? Si ce type est utilisé par au moins un document existant, la suppression sera refusée — désactive-le plutôt via le toggle "Actif" pour préserver l'historique.`}
          />
          <div className="flex gap-2">
            <Link href="/admin/types-documents" className="btn-secondary">
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
