'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Plus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { createDocumentTypeAction, type CreateDocumentTypeState } from './actions';

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

export interface LookupOption {
  id: string;
  label: string;
}

interface Props {
  categories: LookupOption[];
  supplierTypes: LookupOption[];
}

const initialState: CreateDocumentTypeState = { status: 'idle' };

// Retours 24/11 pt 12 — sélection multiple (aucune case = tous).
const TENANT_TYPE_OPTIONS = [
  { value: 'LT', label: 'Locataires LT (long terme)' },
  { value: 'CT', label: 'Locataires CT (court terme)' },
];

const COMPANY_TYPE_OPTIONS = [
  { value: 'commerciale_bilan', label: 'Commerciale (bilan)' },
  { value: 'commerciale_sans_bilan', label: 'Commerciale (sans bilan)' },
  { value: 'immobiliere_bilan', label: 'Immobilière (bilan)' },
  { value: 'immobiliere_sans_bilan', label: 'Immobilière (sans bilan)' },
];

function CheckboxGroup({
  legend,
  name,
  options,
  disabled,
  hint,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  disabled: boolean;
  hint: string;
}) {
  return (
    <fieldset disabled={disabled} className="disabled:opacity-50">
      <legend className="block text-[12px] font-medium text-zinc-700">{legend}</legend>
      <div className="mt-1 space-y-1">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name={name}
              value={o.value}
              className="h-4 w-4 rounded-sm border-zinc-300 text-zinc-900"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>
    </fieldset>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? (
        <>
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          Création…
        </>
      ) : (
        <>
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Créer le type
        </>
      )}
    </button>
  );
}

export function DocumentTypeCreateForm({ categories, supplierTypes }: Props) {
  const [state, formAction] = useFormState(createDocumentTypeAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [scope, setScope] = useState<string>('supplier');

  useEffect(() => {
    if (state.status === 'success' && formRef.current) {
      formRef.current.reset();
      setScope('supplier');
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card space-y-4 p-6">
      {state.status === 'error' && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" strokeWidth={2} />
          <div className="text-[13px] text-red-800">{state.message}</div>
        </div>
      )}
      {state.status === 'success' && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" strokeWidth={2} />
          <div className="text-[13px] text-blue-800">
            Type créé avec succès. Visible dans la liste ci-dessus.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Code (slug)</label>
          <input name="code" required className="input mt-1 font-mono" placeholder="qualibat" />
          <p className="mt-1 text-[11px] text-zinc-500">
            Minuscules, chiffres, underscores uniquement.
          </p>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Libellé</label>
          <input name="label" required className="input mt-1" placeholder="Attestation Qualibat" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Scope</label>
          <select
            name="scope"
            required
            className="input mt-1"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            {Object.entries(SCOPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">
            Catégorie (regroupement transversal)
          </label>
          <select name="categoryId" className="input mt-1" defaultValue="">
            <option value="">— Aucune —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-zinc-500">
            Paramétrable via <span className="font-mono">Paramètres → Catégories de documents</span>
            .
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CheckboxGroup
          legend="Types de locataire (scope client uniquement)"
          name="appliesToTenantTypes"
          options={TENANT_TYPE_OPTIONS}
          disabled={scope !== 'customer'}
          hint="Aucune case cochée = tous les locataires. Ignoré si le scope n'est pas « Client »."
        />
        <CheckboxGroup
          legend="Types de fournisseur (scope fournisseur uniquement)"
          name="supplierTypeIds"
          options={supplierTypes.map((st) => ({ value: st.id, label: st.label }))}
          disabled={scope !== 'supplier'}
          hint="Aucune case cochée = tous les fournisseurs. Sinon, uniquement les fournisseurs des types cochés."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CheckboxGroup
          legend="Types de société (scope société uniquement)"
          name="appliesToCompanyTypes"
          options={COMPANY_TYPE_OPTIONS}
          disabled={scope !== 'company'}
          hint="Aucune case cochée = toutes les sociétés. Sinon, uniquement les sociétés des types cochés."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            name="hasExpiration"
            value="on"
            className="h-4 w-4 rounded-sm border-zinc-300 text-zinc-900"
          />
          <span>Document avec date d'expiration</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            name="isRequired"
            value="on"
            className="h-4 w-4 rounded-sm border-zinc-300 text-zinc-900"
          />
          <span>Document obligatoire (alimente le widget « manquants »)</span>
        </label>
      </div>

      <div className="flex justify-end pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
