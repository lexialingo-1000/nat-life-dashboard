import Link from 'next/link';
import { db } from '@/db/client';
import { documentTypes, marcheTypes, supplierTypes, documentCategories } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { FileBox, HardHat, Tags, Briefcase, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function countOrZero(table: any): Promise<number> {
  try {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table);
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

export default async function ParametresPage() {
  const [docTypesCount, marcheTypesCount, supplierTypesCount, docCategoriesCount] =
    await Promise.all([
      countOrZero(documentTypes),
      countOrZero(marcheTypes),
      countOrZero(supplierTypes),
      countOrZero(documentCategories),
    ]);

  const sections = [
    {
      href: '/admin/types-documents',
      icon: FileBox,
      title: 'Types de documents',
      description:
        'Catalogue extensible des types de documents par scope (société, fournisseur, client, bien, lot, marché, location).',
      count: docTypesCount,
    },
    {
      href: '/admin/document-categories',
      icon: Tags,
      title: 'Catégories de documents',
      description:
        'Regroupement transversal des types (Notaire, Banque, Comptabilité, Urbanisme, etc.).',
      count: docCategoriesCount,
    },
    {
      href: '/admin/marche-types',
      icon: HardHat,
      title: 'Types de marchés',
      description:
        "Corps d'état pour qualifier les sous-lots techniques (Plomberie, Électricité, etc.).",
      count: marcheTypesCount,
    },
    {
      href: '/admin/supplier-types',
      icon: Briefcase,
      title: 'Types de fournisseurs',
      description:
        'Catégories de fournisseurs (Notaire, Banque, Entrepreneur, etc.). Permet de conditionner les documents obligatoires.',
      count: supplierTypesCount,
    },
  ];

  return (
    <div className="space-y-8">
      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
          Administration
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Paramètres</span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] text-zinc-500">
          Catalogues paramétrables du dashboard. Tous les types et catégories sont éditables sans
          intervention dev.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="card group flex items-start gap-4 p-6 transition hover:border-blue-300 hover:shadow-sm"
            >
              <div className="rounded-md bg-blue-50 p-2.5 text-blue-700 group-hover:bg-blue-100">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-[15px] font-medium text-zinc-900">{s.title}</h2>
                  <span className="font-mono text-[12px] tnum text-zinc-400">{s.count}</span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{s.description}</p>
                <div className="mt-2.5 inline-flex items-center gap-1 text-[12px] text-blue-700 group-hover:text-blue-800">
                  Ouvrir <ArrowRight className="h-3 w-3" strokeWidth={2} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
