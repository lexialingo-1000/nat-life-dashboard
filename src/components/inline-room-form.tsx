'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createRoomAction } from '@/app/(dashboard)/biens/actions';

interface Props {
  lotId: string;
  levelId: string;
}

export function InlineRoomForm({ lotId, levelId }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        try {
          setError(null);
          await createRoomAction(formData);
          formRef.current?.reset();
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Erreur lors de la création');
        }
      }}
      className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-zinc-200 bg-[#fbf8f0] px-3 py-2"
      autoComplete="off"
    >
      <input type="hidden" name="lotId" value={lotId} />
      <input type="hidden" name="levelId" value={levelId} />
      <div className="flex-1">
        <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Nouvelle pièce
        </label>
        <input
          name="name"
          required
          placeholder="Salon, cuisine, chambre 1…"
          className="input mt-1"
          autoComplete="off"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
        />
      </div>
      <div className="w-24">
        <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          m²
        </label>
        <input
          name="surfaceM2"
          type="number"
          step="0.1"
          min="0"
          placeholder="—"
          className="input mt-1 tnum"
          autoComplete="off"
        />
      </div>
      <button type="submit" className="btn-secondary">
        <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
        Pièce
      </button>
      {error && <p className="w-full text-[12px] text-red-600">{error}</p>}
    </form>
  );
}
