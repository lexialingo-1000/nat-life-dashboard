/**
 * V1.12 R4 — Helper de pré-flight FK pour les actions de suppression.
 *
 * Source : Remarques client dashboard-16 §4. Le digest générique Next.js prod
 * masque les `throw new Error` côté Server Action. Pour surfacer un message
 * lisible, les delete actions doivent retourner `{ error: msg }` (capturé par
 * `<DeleteButton>` côté client) au lieu de laisser une FK violation Postgres
 * (code 23503) bubble.
 *
 * Usage :
 *   const summary = fkPreflightSummary([
 *     { label: 'marchés', rows: marchesRows },
 *     { label: 'documents', rows: docsRows },
 *   ]);
 *   if (summary) return { error: summary };
 *   await db.delete(...).where(...);
 */

export type FkCheckRow = { id: string; displayName: string };

export type FkCheck = {
  /** Pluriel lisible en français : "marchés", "documents", "biens immobiliers"… */
  label: string;
  /** Lignes child trouvées (limit 5+ via OFFSET côté query, pas ici). */
  rows: FkCheckRow[];
};

/**
 * Retourne un message lisible si au moins un check a des rows. Sinon null.
 * Format : "Impossible de supprimer car présent dans : N1 label1 (nom1, nom2,
 * nom3, nom4, nom5 +X autres) ; N2 label2 (…)."
 *
 * Limit 5 noms par table. Au-delà, suffixe "(+X autres)".
 */
export function fkPreflightSummary(checks: FkCheck[]): string | null {
  const nonEmpty = checks.filter((c) => c.rows.length > 0);
  if (nonEmpty.length === 0) return null;

  const parts = nonEmpty.map((c) => {
    const total = c.rows.length;
    const namesShown = c.rows.slice(0, 5).map((r) => r.displayName).join(', ');
    const moreCount = total - 5;
    const tail = moreCount > 0 ? ` +${moreCount} autres` : '';
    return `${total} ${c.label} (${namesShown}${tail})`;
  });

  return `Impossible de supprimer car présent dans les enregistrements suivants : ${parts.join(' ; ')}.`;
}
