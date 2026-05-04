import { Trash2 } from 'lucide-react';
import {
  deleteLevelAction,
  deleteRoomAction,
} from '@/app/(dashboard)/biens/actions';
import { AddLevelForm } from './add-level-form';
import { AddRoomForm } from './add-room-form';

export type LevelWithRooms = {
  id: string;
  name: string;
  sortOrder: number;
  rooms: { id: string; name: string; surfaceM2: string | null }[];
};

interface Props {
  lotId: string;
  levels: LevelWithRooms[];
}

export function LevelsRoomsManager({ lotId, levels }: Props) {
  return (
    <div className="space-y-5">
      {levels.length === 0 && (
        <p className="rounded-md border border-dashed border-zinc-200 p-4 text-center text-[13px] text-zinc-500">
          Aucun niveau pour l'instant. Ajoute un niveau (RDC, R+1, sous-sol, etc.) pour pouvoir y
          déclarer des pièces.
        </p>
      )}

      {levels.map((lv) => (
        <div key={lv.id} className="rounded-md border border-zinc-200 bg-[#fbf8f0]">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
            <h3 className="text-[13px] font-medium text-zinc-900">{lv.name}</h3>
            <form action={deleteLevelAction}>
              <input type="hidden" name="levelId" value={lv.id} />
              <input type="hidden" name="lotId" value={lotId} />
              <button
                type="submit"
                title="Supprimer le niveau (et ses pièces)"
                className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </form>
          </div>

          <ul className="divide-y divide-zinc-100">
            {lv.rooms.length === 0 ? (
              <li className="px-4 py-3 text-[12px] text-zinc-400">
                Aucune pièce déclarée à ce niveau.
              </li>
            ) : (
              lv.rooms.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between px-4 py-2 text-[13px]"
                >
                  <span className="text-zinc-800">{r.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="tnum text-[12px] text-zinc-500">
                      {r.surfaceM2 ? `${r.surfaceM2} m²` : '—'}
                    </span>
                    <form action={deleteRoomAction}>
                      <input type="hidden" name="roomId" value={r.id} />
                      <input type="hidden" name="lotId" value={lotId} />
                      <button
                        type="submit"
                        title="Supprimer cette pièce"
                        className="rounded p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </form>
                  </div>
                </li>
              ))
            )}
          </ul>

          <AddRoomForm lotId={lotId} levelId={lv.id} />
        </div>
      ))}

      <AddLevelForm lotId={lotId} />
    </div>
  );
}
