'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, HardHat, KeyRound, MoreHorizontal } from 'lucide-react';
import { MobileMoreSheet } from './mobile-more-sheet';

const TABS = [
  { href: '/', label: 'Accueil', icon: LayoutDashboard },
  { href: '/biens', label: 'Biens', icon: Building2 },
  { href: '/marches', label: 'Marchés', icon: HardHat },
  { href: '/locations', label: 'Locations', icon: KeyRound },
] as const;

/** Routes couvertes par le sheet « Plus » — pour l'état actif de l'onglet Plus. */
const MORE_PREFIXES = ['/societes', '/fournisseurs', '/clients', '/admin'];

/**
 * Bottom tab bar mobile (<md) — 4 onglets + « Plus » (bottom sheet).
 * Desktop inchangé (md:hidden). Safe-area iPhone via env(safe-area-inset-bottom).
 */
export function MobileTabBar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isTabActive = (href: string) =>
    href === '/' ? pathname === '/' : !!pathname?.startsWith(href);
  const moreActive = MORE_PREFIXES.some((p) => pathname?.startsWith(p));

  return (
    <>
      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} userEmail={userEmail} />

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#1A3366] bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="grid h-14 grid-cols-5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isTabActive(tab.href) && !moreOpen;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 transition-colors duration-150 ease-out-quart ${
                  active ? 'text-sidebar-active' : 'text-[#7FA3D4]'
                }`}
              >
                {active && <span className="absolute inset-x-4 top-0 h-[2px] bg-[#5BA3E0]" />}
                <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.75} />
                <span className="text-[10px] leading-none">{tab.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="Plus d'options"
            aria-expanded={moreOpen}
            className={`relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 transition-colors duration-150 ease-out-quart ${
              moreActive || moreOpen ? 'text-sidebar-active' : 'text-[#7FA3D4]'
            }`}
          >
            {moreActive && !moreOpen && (
              <span className="absolute inset-x-4 top-0 h-[2px] bg-[#5BA3E0]" />
            )}
            <MoreHorizontal className="h-5 w-5" strokeWidth={moreActive || moreOpen ? 2 : 1.75} />
            <span className="text-[10px] leading-none">Plus</span>
          </button>
        </div>
      </nav>
    </>
  );
}
