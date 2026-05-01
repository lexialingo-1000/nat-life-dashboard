'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Plus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  createDocumentTypeAction,
  type CreateDocumentTypeState,
} from './actions';

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

const initialState: CreateDocumentTypeState = { status: 'idle' };

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

export function DocumentTypeCreateForm() {
  const [state, formAction] = useFormState(createDocumentTypeAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'success' && formRef.current) {
      formRef.current.reset();
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
        <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" strokeWidth={2} />
          <div className="text-[13px] text-emerald-800">
            Type créé avec succès. Visible dans la liste ci-dessus.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Code (slug)</label>
          <input
            name="code"
            required
            className="input mt-1 font-mono"
            placeholder="qualibat"
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            Minuscules, chiffres, underscores uniquement.
          </p>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Libellé</label>
          <input
            name="label"
            required
            className="input mt-1"
            placeholder="Attestation Qualibat"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Scope</label>
          <select name="scope" required className="input mt-1" defaultValue="supplier">
            {Object.entries(SCOPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">
            Type de locataire (scope client uniquement)
          </label>
          <select name="appliesToTenantType" className="input mt-1" defaultValue="">
            <option value="">— Non applicable / tous —</option>
            <option value="LT">Locataires LT (long terme)</option>
            <option value="CT">Locataires CT (court terme)</option>
            <option value="all">Tous les locataires</option>
          </select>
          <p className="mt-1 text-[11px] text-zinc-500">
            Ignoré si le scope n'est pas « Client ».
          </p>
        </div>
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
