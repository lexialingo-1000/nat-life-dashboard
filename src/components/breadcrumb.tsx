'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const SEGMENT_LABELS: Record<string, string> = {
  societes: 'Sociétés',
  fournisseurs: 'Fournisseurs',
  clients: 'Clients',
  biens: 'Patrimoine',
  properties: 'Bien',
  lots: 'Lot',
  marches: 'Marchés',
  'sous-lots': 'Sous-lot',
  taches: 'Tâche',
  locations: 'Locations',
  documents: 'Documents',
  admin: 'Administration',
  'types-documents': 'Types de documents',
  'marche-types': 'Types de marchés',
  parametres: 'Paramètres',
  utilisateurs: 'Utilisateurs',
  edit: 'Édition',
  new: 'Nouveau',
};

// Detect UUID/CUID/numeric ID segments — hide them from breadcrumb (the H1 already
// shows the entity name, repeating an opaque id adds noise).
const ID_REGEX =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9]+|c[a-z0-9]{20,})$/i;

function labelFor(segment: string): string | null {
  if (ID_REGEX.test(segment)) return null;
  return SEGMENT_LABELS[segment] ?? segment.replace(/-/g, ' ');
}

export function Breadcrumb() {
  const pathname = usePathname();

  if (!pathname || pathname === '/') return null;

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  // Build cumulative hrefs + labels, skipping pure-id segments.
  const crumbs: { href: string; label: string }[] = [];
  let acc = '';
  for (const seg of parts) {
    acc += `/${seg}`;
    const label = labelFor(seg);
    if (label) crumbs.push({ href: acc, label });
  }

  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Fil d'Ariane"
      className="mb-4 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500"
    >
      <Link href="/" className="flex items-center gap-1 hover:text-zinc-900">
        <Home className="h-3 w-3" aria-hidden />
        <span className="sr-only">Accueil</span>
      </Link>
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={c.href} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 text-zinc-300" aria-hidden />
            {isLast ? (
              <span className="text-zinc-900">{c.label}</span>
            ) : (
              <Link href={c.href} className="hover:text-zinc-900">
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
