'use client';

import { useRef } from 'react';
import { Plus } from 'lucide-react';
import { createRoomAction } from '@/app/(dashboard)/biens/actions';

interface Props {
  lotId: string;
  levelId: string;
}

export function AddRoomForm({ lotId, levelId }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        await createRoomAction(formData);
        formRef.current?.reset();
      }}
      className="flex items-end gap-2 border-t border-zinc-200 px-4 py-3"
    >
      <input type="hidden" name="levelId" value={levelId} />
      <input type="hidden" name="lotId" value={lotId} />
      <div className="flex-1">
        <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Nom de la pièce
        </label>
        <input
          name="name"
          required
          placeholder="Salon, cuisine, chambre 1…"
          className="input mt-1"
        />
      </div>
      <div className="w-28">
        <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Surface m²
        </label>
        <input
          name="surfaceM2"
          type="number"
          step="0.1"
          min="0"
          placeholder="—"
          className="input mt-1 tnum"
        />
      </div>
      <button type="submit" className="btn-secondary">
        <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
        Pièce
      </button>
    </form>
  );
}
