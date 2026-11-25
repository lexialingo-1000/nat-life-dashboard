// Retours 24/11/2026 pt 6 — libellés de périodicité centralisés (formulaire, tableaux, fiche).
// Valeurs = enum `location_periodicite` (src/db/schema/enums.ts), dans le même ordre.
export const LOCATION_PERIODICITES = [
  { value: 'forfait', label: 'Forfait', suffix: 'forfait' },
  { value: 'jour', label: 'Jour', suffix: '/ jour' },
  { value: 'semaine', label: 'Semaine', suffix: '/ semaine' },
  { value: 'mois', label: 'Mois', suffix: '/ mois' },
  { value: 'trimestre', label: 'Trimestre', suffix: '/ trimestre' },
  { value: 'annee', label: 'Année', suffix: '/ an' },
] as const;

export type LocationPeriodicite = (typeof LOCATION_PERIODICITES)[number]['value'];

export const PERIODICITE_LABELS: Record<string, string> = Object.fromEntries(
  LOCATION_PERIODICITES.map((p) => [p.value, p.label]),
);

export const PERIODICITE_SUFFIX: Record<string, string> = Object.fromEntries(
  LOCATION_PERIODICITES.map((p) => [p.value, p.suffix]),
);
