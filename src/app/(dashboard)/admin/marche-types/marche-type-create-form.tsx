'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Plus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { createMarcheTypeAction, type CreateMarcheTypeState } from './actions';

const initialState: CreateMarcheTypeState = { status: 'idle' };

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

export function MarcheTypeCreateForm() {
  const [state, formAction] = useFormState(createMarcheTypeAction, initialState);
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
          <input name="code" required className="input mt-1 font-mono" placeholder="charpente" />
          <p className="mt-1 text-[11px] text-zinc-500">
            Minuscules, chiffres, underscores uniquement.
          </p>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Libellé</label>
          <input name="label" required className="input mt-1" placeholder="Charpente" />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
