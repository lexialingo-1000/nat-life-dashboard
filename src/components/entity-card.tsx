import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface EntityCardField {
  label: string;
  value: React.ReactNode;
}

/**
 * Carte de liste mobile (rendue par DataTable via renderMobileCard, <md).
 * Titre + badge optionnel + 2-3 champs libellés + chevron. Lien pleine surface.
 * Sobriété EDUC13 : pas d'ombre, pas de gradient. Réutilise .card (ivoire).
 */
export function EntityCard({
  href,
  title,
  badge,
  fields,
}: {
  href: string;
  title: React.ReactNode;
  badge?: React.ReactNode;
  fields: EntityCardField[];
}) {
  return (
    <Link
      href={href}
      className="card flex min-h-[64px] items-center gap-3 p-4 transition-colors active:bg-[#f3eee0]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-[15px] font-medium uppercase tracking-[0.04em] text-zinc-900">
            {title}
          </span>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
        {fields.length > 0 && (
          <dl className="mt-1.5 space-y-0.5">
            {fields.map((f, i) => (
              <div key={i} className="flex gap-1.5 text-[13px] leading-tight">
                <dt className="shrink-0 text-zinc-400">{f.label}</dt>
                <dd className="min-w-0 truncate text-zinc-600">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={1.75} />
    </Link>
  );
}
