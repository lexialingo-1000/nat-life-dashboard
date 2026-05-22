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

interface SousLotOption {
  id: string;
  name: string;
}

interface Props {
  lotOptions: LotOption[];
  lotsStructure: LotStructure[];
  defaultLotId?: string;
  defaultRoomId?: string | null;
  /** Required HTML attribute pour le select lot. */
  required?: boolean;
  // V1.13 R4 — sous-lot rattaché à la tâche, modifiable depuis la fiche
  // (Remarques client dashboard-17 §"FICHE MARCHE DE TRAVAUX"). Optionnel pour
  // compat avec le form de création (où le sous-lot vient du path).
  sousLotOptions?: SousLotOption[];
  defaultSousLotId?: string;
}

/**
 * V12bis umbrella §7 — Wrapper client pour le bloc "Lot rattaché + Niveau + Pièce"
 * du form de tâche. Permet la dépendance live entre les 3 selects.
 *
 * Ordre demandé Natacha (dashboard-13) : LOT RATTACHE au-dessus de NIVEAU/PIECE.
 * V1.13 R4 : Sous-Lot ajouté à droite de Lot rattaché quand sousLotOptions est fourni.
 */
export function TacheLotLocationFieldset({
  lotOptions,
  lotsStructure,
  defaultLotId = '',
  defaultRoomId = null,
  required = false,
  sousLotOptions,
  defaultSousLotId = '',
}: Props) {
  const initial = defaultLotId || lotOptions[0]?.id || '';
  const [lotId, setLotId] = useState(initial);

  const lotSelect = (
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
  );

  const sousLotSelect = sousLotOptions ? (
    <div>
      <label className="block text-[12px] font-medium text-zinc-700">Sous-lot rattaché</label>
      <select
        name="marcheSousLotId"
        defaultValue={defaultSousLotId}
        className="input mt-1"
      >
        {sousLotOptions.length === 0 ? (
          <option value="">— Aucun sous-lot —</option>
        ) : (
          sousLotOptions.map((sl) => (
            <option key={sl.id} value={sl.id}>
              {sl.name}
            </option>
          ))
        )}
      </select>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      {sousLotSelect ? (
        <div className="grid grid-cols-2 gap-4">
          {lotSelect}
          {sousLotSelect}
        </div>
      ) : (
        lotSelect
      )}
      <TacheLocationSelectors
        lotsStructure={lotsStructure}
        lotId={lotId}
        defaultRoomId={defaultRoomId}
      />
    </div>
  );
}
