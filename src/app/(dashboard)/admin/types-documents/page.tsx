import { db } from '@/db/client';
import { documentTypes, documentCategories, supplierTypes } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { BackLink } from '@/components/back-link';
import { DocumentTypeCreateForm } from './document-type-create-form';
import { DocumentTypesSortableList } from './document-types-sortable-list';

export const dynamic = 'force-dynamic';

const SCOPE_LABELS: Record<string, string> = {
  company: 'Société',
  supplier: 'Fournisseur',
  customer: 'Client',
  property: 'Immeuble',
  lot: 'Lot',
  marche: 'Marché',
  marche_lot: 'Sous-lot',
  location: 'Location',
};

const SCOPE_KEYS = Object.keys({
  company: 1,
  supplier: 1,
  customer: 1,
  property: 1,
  lot: 1,
  marche: 1,
  marche_lot: 1,
  location: 1,
});

export default async function TypesDocumentsPage({
  searchParams,
}: {
  searchParams: { scope?: string };
}) {
  const activeScope = SCOPE_KEYS.includes(searchParams.scope ?? '')
    ? searchParams.scope
    : undefined;

  let rows: any[] = [];
  let categories: { id: string; label: string }[] = [];
  let suppliers: { id: string; label: string }[] = [];
  let allCategoriesById: Record<string, string> = {};
  let dbError: string | null = null;
  try {
    const base = db.select().from(documentTypes);
    const filtered = activeScope
      ? base.where(
          eq(documentTypes.scope, activeScope as (typeof documentTypes.$inferSelect)['scope']),
        )
      : base;
    rows = await filtered.orderBy(
      asc(documentTypes.scope),
      asc(documentTypes.sortOrder),
      asc(documentTypes.label),
    );
    categories = await db
      .select({ id: documentCategories.id, label: documentCategories.label })
      .from(documentCategories)
      .where(eq(documentCategories.isActive, true))
      .orderBy(asc(documentCategories.sortOrder), asc(documentCategories.label));
    // V1.13 R1 — map dynamique (inclut catégories inactives) pour résoudre le
    // label affiché sur chaque ligne via documentTypes.categoryId, au lieu de
    // l'enum legacy hardcodé (Remarques client dashboard-17 §"aramètres TYPE
    // DE DOCUMENTS").
    const allCategories = await db
      .select({ id: documentCategories.id, label: documentCategories.label })
      .from(documentCategories);
    allCategoriesById = Object.fromEntries(allCategories.map((c) => [c.id, c.label]));
    suppliers = await db
      .select({ id: supplierTypes.id, label: supplierTypes.label })
      .from(supplierTypes)
      .where(eq(supplierTypes.isActive, true))
      .orderBy(asc(supplierTypes.sortOrder), asc(supplierTypes.label));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  return (
    <div className="space-y-8">
      <BackLink fallbackHref="/admin/parametres" label="Paramètres" />

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
          Administration
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Types de documents</span>
          <span className="ml-2 font-mono text-[13px] tnum text-zinc-400">{rows.length}</span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] text-zinc-500">
          Catalogue extensible — ajoute, désactive ou crée des types pour les sociétés,
          fournisseurs, clients, biens et marchés. Les types marqués obligatoires alimentent le
          widget « Documents requis manquants » sur la fiche concernée. Les types avec date
          d'expiration alimentent le widget de vigilance.
        </p>
      </header>

      {dbError && (
        <div className="card p-6 text-[13px] text-blue-700">
          Connexion DB indisponible : {dbError}
        </div>
      )}

      {!dbError && (
        <form method="get" className="flex items-center gap-3">
          <label className="text-[12px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            Scope
          </label>
          <select name="scope" defaultValue={activeScope ?? ''} className="input w-44 text-[13px]">
            <option value="">Tous les scopes</option>
            {Object.entries(SCOPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary text-[12px]">
            Filtrer
          </button>
          {activeScope && (
            <Link
              href="/admin/types-documents"
              className="text-[12px] text-zinc-400 hover:text-zinc-700"
            >
              Réinitialiser
            </Link>
          )}
        </form>
      )}

      {!dbError && (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-8" />
                <th className="w-[140px]">Scope</th>
                <th>Libellé</th>
                <th className="w-[150px]">Catégorie</th>
                <th className="w-[110px]">Expiration</th>
                <th className="w-[110px]">Obligatoire</th>
                <th className="w-[100px]">Locataire</th>
                <th className="w-[90px]">Statut</th>
                <th className="w-[160px] pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <DocumentTypesSortableList rows={rows} categoriesById={allCategoriesById} />
          </table>
        </div>
      )}

      <section>
        <div className="page-header mb-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
            Catalogue
          </div>
          <h2 className="mt-1.5 text-[20px] font-medium tracking-tight text-zinc-900">
            <span className="display-serif">Ajouter</span> un nouveau type
          </h2>
        </div>

        <DocumentTypeCreateForm categories={categories} supplierTypes={suppliers} />
      </section>
    </div>
  );
}
