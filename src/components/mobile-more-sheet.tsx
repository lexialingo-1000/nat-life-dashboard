'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, ChevronRight } from 'lucide-react';
import { sections, type NavItem } from './nav-items';

/** Hrefs déjà couverts par les onglets de la tab bar — exclus du sheet. */
const TAB_HREFS = new Set(['/', '/biens', '/marches', '/locations']);

/**
 * Bottom sheet « Plus » du shell mobile.
 * Liste les items de navigation non couverts par la tab bar
 * (Sociétés, Fournisseurs, Clients, Paramètres + sous-items, Utilisateurs)
 * + email user + Déconnexion. Ferme sur : changement de route, clic overlay, Escape.
 */
export function MobileMoreSheet({
  open,
  onClose,
  userEmail,
}: {
  open: boolean;
  onClose: () => void;
  userEmail: string | null;
}) {
  const pathname = usePathname();

  // Fermer après navigation (même pattern que l'ex-drawer sidebar-shell).
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const items: NavItem[] = sections
    .flatMap((s) => s.items)
    .filter((item) => !TAB_HREFS.has(item.href));

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panneau slide-up */}
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-xl bg-sidebar text-sidebar-fg transition-transform duration-200 ease-out-quart md:hidden ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Poignée */}
        <div className="flex justify-center pb-1 pt-3">
          <span className="h-1 w-9 rounded-full bg-[#3D5A8A]" />
        </div>

        <nav className="max-h-[60vh] overflow-y-auto px-3 pb-2">
          <ul className="space-y-px">
            {items.map((item) => (
              <MoreSheetItem key={item.href} item={item} pathname={pathname} />
            ))}
          </ul>
        </nav>

        <div className="mx-6 border-t border-[#1A3366]" />
        <div className="px-3 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
          <div className="mb-1 px-3 text-[12px] text-[#4A6A9E]">
            {userEmail ?? 'Non authentifié'}
          </div>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="flex min-h-[48px] w-full items-center gap-3 rounded-sm px-3 py-1.5 text-[14px] text-[#7FA3D4] transition-colors duration-150 ease-out-quart hover:bg-white/10 hover:text-[#D0E2F4]"
            >
              <LogOut className="h-[16px] w-[16px]" strokeWidth={1.75} />
              Déconnexion
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function MoreSheetItem({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const Icon = item.icon;
  const hasActiveChild = item.children?.some((c) => pathname?.startsWith(c.href));
  const isActive =
    pathname === item.href ||
    (item.children ? hasActiveChild : item.href !== '/' && pathname?.startsWith(item.href));
  const [openChildren, setOpenChildren] = useState(!!hasActiveChild);

  return (
    <li>
      <div
        className={`flex min-h-[48px] items-center gap-3 rounded-sm px-3 text-[14px] transition-colors duration-150 ease-out-quart ${
          isActive
            ? 'bg-[#163060] text-sidebar-active'
            : 'text-[#7FA3D4] hover:bg-white/10 hover:text-[#D0E2F4]'
        }`}
      >
        <Link href={item.href} className="flex min-h-[48px] flex-1 items-center gap-3">
          <Icon
            className={`h-[17px] w-[17px] ${isActive ? 'text-sidebar-active' : 'text-[#5A85B8]'}`}
            strokeWidth={1.75}
          />
          {item.label}
        </Link>
        {item.children && (
          <button
            type="button"
            onClick={() => setOpenChildren((v) => !v)}
            aria-label={openChildren ? 'Replier' : 'Déplier'}
            aria-expanded={openChildren}
            className="flex h-11 w-11 items-center justify-center rounded transition-colors hover:bg-white/10"
          >
            <ChevronRight
              className={`h-4 w-4 text-[#5A85B8] transition-transform ${
                openChildren ? 'rotate-90' : ''
              }`}
              strokeWidth={1.75}
            />
          </button>
        )}
      </div>
      {item.children && openChildren && (
        <ul className="ml-8 mt-px space-y-px border-l border-[#1A3366]/60 pl-2">
          {item.children.map((child) => {
            const childActive = pathname?.startsWith(child.href);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={`flex min-h-[44px] items-center rounded-sm px-2 text-[13px] transition-colors duration-150 ease-out-quart ${
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
    </li>
  );
}
