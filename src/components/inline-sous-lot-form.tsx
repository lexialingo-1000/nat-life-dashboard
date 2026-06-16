'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createSousLotAction } from '@/app/(dashboard)/marches/actions';

interface Props {
  marcheId: string;
}

/**
 * V11 (Natacha §U1) — Création inline d'un sous-lot (corps d'état) depuis
 * l'onglet Suivi d'un marché. Avant V11 il n'y avait aucune affordance
 * de création → Natacha ne savait pas comment alimenter la cascade.
 *
 * Pattern aligné sur `inline-room-form.tsx` (V1.4 R7).
 */
export function InlineSousLotForm({ marcheId }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        try {
          setError(null);
          await createSousLotAction(formData);
          formRef.current?.reset();
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Erreur lors de la création');
        }
      }}
      className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-zinc-200 bg-[#fbf8f0] px-3 py-2"
      autoComplete="off"
    >
      <input type="hidden" name="marcheId" value={marcheId} />
      <div className="flex-1 min-w-[180px]">
        <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Nouveau sous-lot (corps d'état)
        </label>
        <input
          name="name"
          required
          placeholder="Plomberie, Électricité, Peinture…"
          className="input mt-1"
          autoComplete="off"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
        />
      </div>
      <div className="w-28">
        <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Montant HT
        </label>
        <input
          name="amountHt"
          type="number"
          step="0.01"
          min="0"
          placeholder="—"
          className="input mt-1 tnum"
          autoComplete="off"
        />
      </div>
      <button type="submit" className="btn-secondary">
        <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
        Sous-lot
      </button>
      {error && <p className="w-full text-[12px] text-red-600">{error}</p>}
    </form>
  );
}
