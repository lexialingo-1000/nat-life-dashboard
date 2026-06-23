'use client';

import { useState } from 'react';

/**
 * dashboard-22 mobile — visibilité de colonnes persistée en localStorage, avec
 * défauts spécifiques aux écrans étroits (vue carte mobile).
 *
 * Map `{ [columnId]: boolean }` : une colonne est visible sauf si sa valeur est
 * explicitement `false` (convention partagée avec TanStack `VisibilityState`).
 *
 * - `key` fourni → état lu/écrit dans localStorage (bouton « Colonnes »).
 * - `mobileDefaults` appliqué uniquement au tout premier rendu, sur un écran
 *   < 640px et sans valeur déjà mémorisée : masque par défaut les colonnes
 *   secondaires sur portable, tout en laissant l'utilisateur les réactiver.
 *
 * Extrait de la logique inline de `data-table.tsx` pour être partagé avec
 * `TachesListTable` (table HTML custom hors TanStack).
 */
export type ColumnVisibility = Record<string, boolean>;

export function useColumnVisibility(
  key?: string,
  mobileDefaults?: ColumnVisibility,
): readonly [ColumnVisibility, (next: ColumnVisibility) => void] {
  const [vis, setVis] = useState<ColumnVisibility>(() => {
    if (!key) return {};
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved) as ColumnVisibility;
    } catch {
      // localStorage indisponible / JSON corrompu → on retombe sur les défauts.
    }
    const isMobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
    return isMobile && mobileDefaults ? mobileDefaults : {};
  });

  const update = (next: ColumnVisibility) => {
    setVis(next);
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // best-effort : pas bloquant si localStorage est plein/refusé.
      }
    }
  };

  return [vis, update] as const;
}
