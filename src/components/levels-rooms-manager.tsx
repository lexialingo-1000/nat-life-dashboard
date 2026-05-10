import { RoomsSortableList } from './rooms-sortable-list';
import { InlineLevelForm } from './inline-level-form';
import { InlineRoomForm } from './inline-room-form';
import { DeleteLevelButton } from './delete-level-button';

export type LevelWithRooms = {
  id: string;
  name: string;
  sortOrder: number;
  rooms: { id: string; name: string; surfaceM2: string | null; sortOrder: number }[];
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
            <DeleteLevelButton levelId={lv.id} lotId={lotId} levelName={lv.name} />
          </div>

          <ul className="divide-y divide-zinc-100">
            <RoomsSortableList rooms={lv.rooms} levelId={lv.id} lotId={lotId} />
          </ul>

          <div className="border-t border-zinc-200 px-4 py-3">
            <InlineRoomForm lotId={lotId} levelId={lv.id} />
          </div>
        </div>
      ))}

      <InlineLevelForm lotId={lotId} />
    </div>
  );
}
