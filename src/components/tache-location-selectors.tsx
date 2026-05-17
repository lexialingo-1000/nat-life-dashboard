'use client';

import { useEffect, useMemo, useState } from 'react';

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
  /** Structure niveau/pièces par lot, fournie côté serveur. */
  lotsStructure: LotStructure[];
  /** Lot sélectionné dans le parent (live state). */
  lotId: string;
  /** roomId courant (édition) — sélection initiale du select pièce. */
  defaultRoomId?: string | null;
  /** Nom du champ caché soumis (FormData key). */
  name?: string;
}

/**
 * V12bis umbrella §7 — sélecteurs NIVEAU + PIECE pour la Fiche Tâche
 * (retours Natacha dashboard-13). Remplace le champ libre `locationDescription`.
 *
 * - NIVEAU est filtré par `lotId` parent (live).
 * - PIECES est filtré par le NIVEAU sélectionné.
 * - Émet un hidden input `name="roomId"` (default) avec l'id de la pièce
 *   sélectionnée (ou vide si aucune).
 *
 * Si le lot n'a pas de niveaux configurés en DB, les selects sont disabled et
 * un message d'aide pointe vers la création de la structure depuis la fiche bien.
 */
export function TacheLocationSelectors({
  lotsStructure,
  lotId,
  defaultRoomId = null,
  name = 'roomId',
}: Props) {
  const levelsForLot = useMemo(() => {
    return lotsStructure.find((ls) => ls.lotId === lotId)?.levels ?? [];
  }, [lotsStructure, lotId]);

  const initialLevelId = useMemo(() => {
    if (!defaultRoomId) return '';
    for (const lvl of levelsForLot) {
      if (lvl.rooms.some((r) => r.id === defaultRoomId)) return lvl.id;
    }
    return '';
  }, [defaultRoomId, levelsForLot]);

  const [levelId, setLevelId] = useState<string>(initialLevelId);
  const [roomId, setRoomId] = useState<string>(defaultRoomId ?? '');

  // Quand le lot change côté parent, on reset niveau + pièce (sauf si la
  // sélection courante est toujours valide pour le nouveau lot).
  useEffect(() => {
    const isLevelStillValid = levelsForLot.some((lvl) => lvl.id === levelId);
    if (!isLevelStillValid) {
      setLevelId('');
      setRoomId('');
    }
  }, [levelsForLot, levelId]);

  const roomsForLevel = useMemo(() => {
    return levelsForLot.find((lvl) => lvl.id === levelId)?.rooms ?? [];
  }, [levelsForLot, levelId]);

  const handleLevelChange = (next: string) => {
    setLevelId(next);
    setRoomId('');
  };

  if (levelsForLot.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Niveau</label>
          <select disabled className="input mt-1 bg-zinc-50 text-zinc-400">
            <option>— Aucun niveau —</option>
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Pièce</label>
          <select disabled className="input mt-1 bg-zinc-50 text-zinc-400">
            <option>— Aucune pièce —</option>
          </select>
        </div>
        <p className="col-span-2 text-[11px] text-zinc-500">
          Le lot rattaché n&apos;a pas de niveaux configurés. Crée-les depuis la fiche bien
          (onglet Structure) avant d&apos;associer une pièce à la tâche.
        </p>
        <input type="hidden" name={name} value="" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-[12px] font-medium text-zinc-700">Niveau</label>
        <select
          value={levelId}
          onChange={(e) => handleLevelChange(e.target.value)}
          className="input mt-1"
        >
          <option value="">— Sélectionner —</option>
          {levelsForLot.map((lvl) => (
            <option key={lvl.id} value={lvl.id}>
              {lvl.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[12px] font-medium text-zinc-700">Pièce</label>
        <select
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          disabled={!levelId}
          className="input mt-1 disabled:bg-zinc-50 disabled:text-zinc-400"
        >
          <option value="">— Sélectionner —</option>
          {roomsForLevel.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <input type="hidden" name={name} value={roomId} />
    </div>
  );
}
