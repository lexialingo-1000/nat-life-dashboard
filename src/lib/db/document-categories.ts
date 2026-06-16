/**
 * V1.13 R1 — Helper réutilisé par les pages qui rendent <DocumentsManager>.
 *
 * Source : Remarques client dashboard-17 §"aramètres TYPE DE DOCUMENTS". Quand
 * l'admin renomme une catégorie depuis /admin/document-categories, le label
 * doit se propager partout. <DocumentsManager> accepte `categoriesMap` (V1.11
 * R9) pour résoudre dynamiquement le label affiché ; sans ce map, il tombe sur
 * un fallback hardcodé. Toutes les pages doivent donc fetcher ce map.
 */
import { db } from '@/db/client';
import { documentCategories } from '@/db/schema';

export async function loadDocumentCategoriesMap(): Promise<Record<string, string>> {
  const cats = await db
    .select({ code: documentCategories.code, label: documentCategories.label })
    .from(documentCategories);
  return Object.fromEntries(cats.map((c) => [c.code, c.label]));
}
