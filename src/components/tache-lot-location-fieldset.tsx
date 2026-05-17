'use client';

import { useState } from 'react';
import { TacheLocationSelectors } from './tache-location-selectors';

interface LotOption {
  id: string;
  name: string;
}
interface Room {
  id: string;
  name: string;
}
interface Level {
  id: string;
  name: string;
  rooms: Room[];
}
interface LotStructure {
  lotId: string;
  levels: Level[];
}

interface Props {
  lotOptions: LotOption[];
  lotsStructure: LotStructure[];
  defaultLotId?: string;
  defaultRoomId?: string | null;
  /** Required HTML attribute pour le select lot. */
  required?: boolean;
}

/**
 * V12bis umbrella §7 — Wrapper client pour le bloc "Lot rattaché + Niveau + Pièce"
 * du form de tâche. Permet la dépendance live entre les 3 selects.
 *
 * Ordre demandé Natacha (dashboard-13) : LOT RATTACHE au-dessus de NIVEAU/PIECE.
 */
export function TacheLotLocationFieldset({
  lotOptions,
  lotsStructure,
  defaultLotId = '',
  defaultRoomId = null,
  required = false,
}: Props) {
  const initial = defaultLotId || lotOptions[0]?.id || '';
  const [lotId, setLotId] = useState(initial);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[12px] font-medium text-zinc-700">
          Lot rattaché {required && <span className="text-blue-700">*</span>}
        </label>
        <select
          name="lotId"
          required={required}
          value={lotId}
          onChange={(e) => setLotId(e.target.value)}
          className="input mt-1"
        >
          {lotOptions.length === 0 ? (
            <option value="">— Aucun lot affecté au marché —</option>
          ) : (
            <>
              {!defaultLotId && <option value="">— Sélectionner —</option>}
              {lotOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </>
          )}
        </select>
      </div>
      <TacheLocationSelectors
        lotsStructure={lotsStructure}
        lotId={lotId}
        defaultRoomId={defaultRoomId}
      />
    </div>
  );
}
