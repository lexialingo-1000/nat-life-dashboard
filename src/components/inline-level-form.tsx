import { Plus } from 'lucide-react';
import { createLevelAction } from '@/app/(dashboard)/biens/actions';

interface Props {
  lotId: string;
}

export function InlineLevelForm({ lotId }: Props) {
  return (
    <form
      action={createLevelAction}
      className="flex items-end gap-2 rounded-md border border-dashed border-zinc-200 bg-[#fbf8f0] px-3 py-2"
    >
      <input type="hidden" name="lotId" value={lotId} />
      <div className="flex-1">
        <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Nouveau niveau
        </label>
        <input
          name="name"
          required
          placeholder="RDC, R+1, sous-sol…"
          className="input mt-1"
        />
      </div>
      <button type="submit" className="btn-secondary">
        <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
        Niveau
      </button>
    </form>
  );
}
