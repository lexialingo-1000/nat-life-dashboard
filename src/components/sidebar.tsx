'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Users,
  UserCircle,
  LayoutDashboard,
  Hammer,
  Settings,
  LogOut,
  Briefcase,
  HardHat,
  KeyRound,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<any>;
  children?: { href: string; label: string }[];
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: 'Synthèse',
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
      { href: '/locations', label: 'Locations', icon: KeyRound },
      { href: '/marches', label: 'Marchés de travaux', icon: HardHat },
    ],
  },
  {
    title: 'Administration',
    items: [
      // V12bis PR6 — sous-menu déroulant sur Paramètres
      {
        href: '/admin/parametres',
        label: 'Paramètres',
        icon: Settings,
        children: [
          { href: '/admin/types-documents', label: 'Types de documents' },
          { href: '/admin/document-categories', label: 'Catégories de documents' },
          { href: '/admin/marche-types', label: 'Types de marchés' },
          { href: '/admin/supplier-types', label: 'Types de fournisseurs' },
        ],
      },
      { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
    ],
  },
];

export function SidebarContent({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();

  // Items à enfants : section ouverte si on est sur /admin/parametres ou un sous-item.
  const isParametresActive =
    pathname === '/admin/parametres' ||
    pathname?.startsWith('/admin/types-documents') ||
    pathname?.startsWith('/admin/document-categories') ||
    pathname?.startsWith('/admin/marche-types') ||
    pathname?.startsWith('/admin/supplier-types');

  const [openMap, setOpenMap] = useState<Record<string, boolean>>({
    '/admin/parametres': isParametresActive ?? false,
  });

  const toggleOpen = (href: string) => {
    setOpenMap((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  return (
    <div className="flex h-full w-[260px] flex-col bg-sidebar text-sidebar-fg">
      <div className="flex h-16 items-baseline gap-2 px-6 pt-6">
        <span className="font-serif text-[22px] leading-none tracking-tight text-sidebar-active">
          Nat Life
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#3D5A8A]">v1</span>
      </div>

      <div className="px-6 pb-6 text-[12px] leading-relaxed text-[#4A6A9E]">
        Gestion patrimoniale
        <br />
        multi-société
      </div>

      <div className="mx-6 border-t border-[#1A3366]" />

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            <h3 className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#2D4A7A]">
              {section.title}
            </h3>
            <ul className="space-y-px">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isExactActive = pathname === item.href;
                const isWithinScope = item.href !== '/' && pathname?.startsWith(item.href);
                const hasActiveChild = item.children?.some((c) => pathname?.startsWith(c.href));
                const isActive = isExactActive || (item.children ? hasActiveChild : isWithinScope);
                const open = openMap[item.href] ?? !!hasActiveChild;

                return (
                  <li key={item.href}>
                    {item.children ? (
                      <>
                        <div
                          className={`group relative flex items-center gap-3 rounded-sm px-3 py-2 text-[13px] transition-colors duration-150 ease-out-quart max-md:min-h-[44px] ${
                            isActive
                              ? 'bg-[#163060] text-sidebar-active'
                              : 'text-[#7FA3D4] hover:bg-white/10 hover:text-[#D0E2F4]'
                          }`}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-[#5BA3E0]" />
                          )}
                          <Link href={item.href} className="flex flex-1 items-center gap-3">
                            <Icon
                              className={`h-[15px] w-[15px] ${
                                isActive
                                  ? 'text-sidebar-active'
                                  : 'text-[#5A85B8] group-hover:text-[#8BBCE8]'
                              }`}
                              strokeWidth={1.75}
                            />
                            {item.label}
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleOpen(item.href)}
                            aria-label={open ? 'Replier' : 'Déplier'}
                            aria-expanded={open}
                            className="rounded p-0.5 transition-colors hover:bg-white/10"
                          >
                            <ChevronRight
                              className={`h-3.5 w-3.5 text-[#5A85B8] transition-transform ${
                                open ? 'rotate-90' : ''
                              }`}
                              strokeWidth={1.75}
                            />
                          </button>
                        </div>
                        {open && (
                          <ul className="ml-7 mt-px space-y-px border-l border-[#1A3366]/60 pl-2">
                            {item.children.map((child) => {
                              const childActive = pathname?.startsWith(child.href);
                              return (
                                <li key={child.href}>
                                  <Link
                                    href={child.href}
                                    className={`block rounded-sm px-2 py-1 text-[12px] transition-colors duration-150 ease-out-quart max-md:flex max-md:min-h-[40px] max-md:items-center ${
                                      childActive
                                        ? 'bg-[#163060] text-sidebar-active'
                                        : 'text-[#7FA3D4] hover:bg-white/10 hover:text-[#D0E2F4]'
                                    }`}
                                  >
                                    {child.label}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        className={`group relative flex items-center gap-3 rounded-sm px-3 py-2 text-[13px] transition-colors duration-150 ease-out-quart max-md:min-h-[44px] ${
                          isActive
                            ? 'bg-[#163060] text-sidebar-active'
                            : 'text-[#7FA3D4] hover:bg-white/10 hover:text-[#D0E2F4]'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-[#5BA3E0]" />
                        )}
                        <Icon
                          className={`h-[15px] w-[15px] ${
                            isActive
                              ? 'text-sidebar-active'
                              : 'text-[#5A85B8] group-hover:text-[#8BBCE8]'
                          }`}
                          strokeWidth={1.75}
                        />
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mx-6 border-t border-[#1A3366]" />
      <div className="px-3 py-4">
        <div className="mb-1 px-3 text-[12px] text-[#4A6A9E]">{userEmail ?? 'Non authentifié'}</div>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-sm px-3 py-1.5 text-[13px] text-[#7FA3D4] transition-colors duration-150 ease-out-quart hover:bg-white/10 hover:text-[#D0E2F4]"
          >
            <LogOut className="h-[15px] w-[15px]" strokeWidth={1.75} />
            Déconnexion
          </button>
        </form>
      </div>
    </div>
  );
}
