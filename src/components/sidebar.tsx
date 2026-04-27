'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Users,
  UserCircle,
  LayoutDashboard,
  FileText,
  Hammer,
  Settings,
  LogOut,
  Briefcase,
  HardHat,
  FileBox,
} from 'lucide-react';

const sections = [
  {
    title: "Synthèse",
    items: [{ href: '/', label: 'Tableau de bord', icon: LayoutDashboard }],
  },
  {
    title: 'Référentiels',
    items: [
      { href: '/societes', label: 'Sociétés', icon: Briefcase },
      { href: '/fournisseurs', label: 'Fournisseurs', icon: Hammer },
      { href: '/clients', label: 'Clients', icon: UserCircle },
    ],
  },
  {
    title: 'Patrimoine',
    items: [
      { href: '/biens', label: 'Biens immobiliers', icon: Building2 },
      { href: '/marches', label: 'Marchés de travaux', icon: HardHat },
    ],
  },
  {
    title: 'Administration',
    items: [
      { href: '/admin/types-documents', label: 'Types de documents', icon: FileBox },
      { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
      { href: '/admin/parametres', label: 'Paramètres', icon: Settings },
    ],
  },
];

export function Sidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[260px] flex-col bg-zinc-950 text-zinc-300">
      {/* Logo */}
      <div className="flex h-16 items-baseline gap-2 px-6 pt-6">
        <span className="font-serif text-[22px] italic leading-none tracking-tight text-white">
          Nat Life
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          v1
        </span>
      </div>

      {/* Subtitle */}
      <div className="px-6 pb-6 text-[11px] leading-relaxed text-zinc-500">
        Gestion patrimoniale<br />multi-société
      </div>

      {/* Divider */}
      <div className="mx-6 border-t border-zinc-900" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            <h3 className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600">
              {section.title}
            </h3>
            <ul className="space-y-px">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname?.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`group relative flex items-center gap-3 rounded-sm px-3 py-2 text-[13px] transition-colors ${
                        isActive
                          ? 'bg-zinc-900 text-white'
                          : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-amber-500" />
                      )}
                      <Icon
                        className={`h-[15px] w-[15px] ${
                          isActive ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'
                        }`}
                        strokeWidth={1.75}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer / user */}
      <div className="mx-6 border-t border-zinc-900" />
      <div className="px-3 py-4">
        <div className="mb-1 px-3 text-[11px] text-zinc-500">{userEmail ?? 'Non authentifié'}</div>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-sm px-3 py-1.5 text-[13px] text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
          >
            <LogOut className="h-[15px] w-[15px]" strokeWidth={1.75} />
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  );
}
