import Link from 'next/link';
import { ChevronRight, Trash2, Building2, Layers, DoorOpen, Plus } from 'lucide-react';
import {
  deleteLevelAction,
  deleteRoomAction,
} from '@/app/(dashboard)/biens/actions';
import { InlineLevelForm } from './inline-level-form';
import { InlineRoomForm } from './inline-room-form';

const LOT_TYPE_LABELS: Record<string, string> = {
  appartement: 'Appartement',
  maison: 'Maison',
  garage: 'Garage',
  immeuble: 'Immeuble',
  terrain: 'Terrain',
};

const LOT_STATUS_LABELS: Record<string, string> = {
  vacant: 'Vacant',
  loue_annuel: 'Loué annuel',
  loue_saisonnier: 'Loué saisonnier',
  travaux: 'Travaux',
};

const LOT_STATUS_BADGE: Record<string, string> = {
  vacant: 'badge-neutral',
  loue_annuel: 'badge-emerald',
  loue_saisonnier: 'badge-emerald',
  travaux: 'badge-amber',
};

export interface RoomNode {
  id: string;
  name: string;
  surfaceM2: string | null;
}

export interface LevelNode {
  id: string;
  name: string;
  rooms: RoomNode[];
}

export interface LotNode {
  id: string;
  name: string;
  type: string;
  status: string;
  surfaceCarrez: string | null;
  levels: LevelNode[];
}

export interface PropertyTree {
  id: string;
  name: string;
  type: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  companyId: string;
  companyName: string;
  lots: LotNode[];
}

export function PropertyStructureTree({ tree }: { tree: PropertyTree }) {
  return (
    <div className="card overflow-hidden">
      <details open className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between border-b border-zinc-200 px-5 py-4 transition-colors hover:bg-zinc-50/60">
          <div className="flex items-center gap-3">
            <ChevronRight
              className="h-4 w-4 text-zinc-500 transition-transform duration-150 group-open:rotate-90"
              strokeWidth={2}
            />
            <Building2 className="h-5 w-5 text-emerald-700" strokeWidth={1.75} />
            <div>
              <div className="text-[15px] font-medium text-zinc-900 display-serif">
                {tree.name}
              </div>
              <div className="text-[12px] text-zinc-500">
                {LOT_TYPE_LABELS[tree.type] ?? tree.type} ·{' '}
                {tree.address ?? 'adresse à compléter'}
                {tree.postalCode && tree.city && ` · ${tree.postalCode} ${tree.city}`}
              </div>
            </div>
          </div>
          <span className="badge-neutral">
            {tree.lots.length} {tree.lots.length > 1 ? 'lots' : 'lot'}
          </span>
        </summary>

        <div className="space-y-3 px-5 py-4">
          {tree.lots.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-200 p-6 text-center">
              <p className="text-[13px] text-zinc-500">
                Aucun lot dans ce bien. Crée un premier lot pour démarrer la structure.
              </p>
              <Link
                href={`/biens/properties/${tree.id}/lots/new`}
                className="btn-primary mt-3 inline-flex items-center"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
                Ajouter un premier lot
              </Link>
            </div>
          ) : (
            <>
              {tree.lots.map((lot) => (
                <LotBranch key={lot.id} lot={lot} />
              ))}

              <Link
                href={`/biens/properties/${tree.id}/lots/new`}
                className="ml-6 inline-flex items-center gap-1 text-[12px] text-emerald-700 hover:text-emerald-800"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Ajouter un lot
              </Link>
            </>
          )}
        </div>
      </details>
    </div>
  );
}

function LotBranch({ lot }: { lot: LotNode }) {
  const totalRooms = lot.levels.reduce((acc, lv) => acc + lv.rooms.length, 0);
  return (
    <details open className="group/lot ml-6 rounded-md border-l-2 border-emerald-200 bg-[#fbf8f0]/40 pl-3">
      <summary className="flex cursor-pointer list-none items-center justify-between py-2 pr-2">
        <div className="flex items-center gap-2">
          <ChevronRight
            className="h-3.5 w-3.5 text-zinc-500 transition-transform duration-150 group-open/lot:rotate-90"
            strokeWidth={2}
          />
          <Layers className="h-4 w-4 text-emerald-700" strokeWidth={1.75} />
          <Link
            href={`/biens/lots/${lot.id}`}
            className="link-cell text-[14px] font-medium uppercase tracking-[0.04em]"
            title="Ouvrir la fiche complète du lot"
          >
            {lot.name}
          </Link>
          <span className={LOT_STATUS_BADGE[lot.status] ?? 'badge-neutral'}>
            {LOT_STATUS_LABELS[lot.status] ?? lot.status}
          </span>
          <span className="text-[12px] text-zinc-500">
            · {LOT_TYPE_LABELS[lot.type] ?? lot.type}
            {lot.surfaceCarrez && (
              <span className="tnum"> · {lot.surfaceCarrez} m² Carrez</span>
            )}
          </span>
        </div>
        <span className="text-[11px] text-zinc-400">
          {lot.levels.length} {lot.levels.length > 1 ? 'niveaux' : 'niveau'}
          {' · '}
          {totalRooms} {totalRooms > 1 ? 'pièces' : 'pièce'}
        </span>
      </summary>

      <div className="space-y-2 py-2 pl-3">
        {lot.levels.length === 0 ? (
          <p className="text-[12px] italic text-zinc-400">
            Aucun niveau déclaré dans ce lot.
          </p>
        ) : (
          lot.levels.map((level) => (
            <LevelBranch key={level.id} level={level} lotId={lot.id} />
          ))
        )}

        <InlineLevelForm lotId={lot.id} />
      </div>
    </details>
  );
}

function LevelBranch({ level, lotId }: { level: LevelNode; lotId: string }) {
  return (
    <details open className="group/level ml-6 rounded-md border-l-2 border-zinc-200 bg-white/40 pl-3">
      <summary className="flex cursor-pointer list-none items-center justify-between py-1.5 pr-2">
        <div className="flex items-center gap-2">
          <ChevronRight
            className="h-3.5 w-3.5 text-zinc-500 transition-transform duration-150 group-open/level:rotate-90"
            strokeWidth={2}
          />
          <span className="text-[13px] font-medium text-zinc-800">
            🪜 {level.name}
          </span>
          <span className="text-[11px] text-zinc-400">
            ({level.rooms.length} {level.rooms.length > 1 ? 'pièces' : 'pièce'})
          </span>
        </div>
        <form action={deleteLevelAction}>
          <input type="hidden" name="levelId" value={level.id} />
          <input type="hidden" name="lotId" value={lotId} />
          <button
            type="submit"
            title="Supprimer le niveau (et ses pièces)"
            className="rounded p-1 text-red-500 transition hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3" strokeWidth={1.75} />
          </button>
        </form>
      </summary>

      <ul className="space-y-1 py-1.5 pl-3">
        {level.rooms.length === 0 ? (
          <li className="text-[12px] italic text-zinc-400">
            Aucune pièce déclarée à ce niveau.
          </li>
        ) : (
          level.rooms.map((room) => (
            <li
              key={room.id}
              className="flex items-center justify-between rounded px-2 py-1 text-[13px] hover:bg-zinc-50"
            >
              <div className="flex items-center gap-2">
                <DoorOpen className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.75} />
                <span className="text-zinc-800">{room.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="tnum text-[12px] text-zinc-500">
                  {room.surfaceM2 ? `${room.surfaceM2} m²` : '—'}
                </span>
                <form action={deleteRoomAction}>
                  <input type="hidden" name="roomId" value={room.id} />
                  <input type="hidden" name="lotId" value={lotId} />
                  <button
                    type="submit"
                    title="Supprimer cette pièce"
                    className="rounded p-1 text-red-500 transition hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                  </button>
                </form>
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="px-3 pb-2">
        <InlineRoomForm lotId={lotId} levelId={level.id} />
      </div>
    </details>
  );
}
