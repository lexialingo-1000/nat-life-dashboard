import { Plus } from 'lucide-react';
import { createRoomAction } from '@/app/(dashboard)/biens/actions';

interface Props {
  lotId: string;
  levelId: string;
}

export function InlineRoomForm({ lotId, levelId }: Props) {
  return (
    <form
      action={createRoomAction}
      className="flex items-end gap-2 rounded-md border border-dashed border-zinc-200 bg-[#fbf8f0] px-3 py-2"
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
        />
      </div>
      <button type="submit" className="btn-secondary">
        <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
        Pièce
      </button>
    </form>
  );
}
