export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function expirationStatus(expiresAt: Date | string | null | undefined): {
  label: string;
  color: 'green' | 'orange' | 'red' | 'gray';
} {
  if (!expiresAt) return { label: '—', color: 'gray' };
  const days = daysUntil(expiresAt);
  if (days === null) return { label: '—', color: 'gray' };
  if (days < 0) return { label: `Expirée depuis ${-days}j`, color: 'red' };
  if (days < 30) return { label: `Expire dans ${days}j`, color: 'orange' };
  return { label: `Valide jusqu'au ${formatDate(expiresAt)}`, color: 'green' };
}

// Retours 24/11 pt 1 — tri des tâches par statut = ordre de l'enum `marche_tache_status`
// (En attente → À faire → En cours → Terminé → Validé), pas l'ordre alphabétique du code.
const TACHE_STATUS_ORDER = ['en_attente', 'a_faire', 'en_cours', 'termine', 'valide'];
export function tacheStatusRank(status: string): number {
  const i = TACHE_STATUS_ORDER.indexOf(status);
  return i === -1 ? TACHE_STATUS_ORDER.length : i;
}
/** Copie triée par statut (tri stable : l'ordre d'origine est gardé à statut égal). */
export function sortByTacheStatus<T extends { status: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => tacheStatusRank(a.status) - tacheStatusRank(b.status));
}
