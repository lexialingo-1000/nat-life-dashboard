'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { SidebarContent } from './sidebar';

/**
 * Enveloppe responsive de la sidebar.
 * - Desktop (md+) : sidebar statique, comportement V1 inchangé.
 * - Mobile (<md)  : topbar avec hamburger + drawer off-canvas + overlay.
 * Le drawer se referme automatiquement à chaque changement de route.
 */
export function SidebarShell({ userEmail }: { userEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Fermer le drawer après navigation (sinon il reste ouvert sur la nouvelle page).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Sidebar desktop — flux normal, masquée sur mobile */}
      <div className="hidden h-screen shrink-0 md:flex">
        <SidebarContent userEmail={userEmail} />
      </div>

      {/* Topbar mobile — masquée sur desktop */}
      <header className="flex h-14 shrink-0 items-center gap-3 bg-sidebar px-4 text-sidebar-fg md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          className="flex h-10 w-10 items-center justify-center rounded-sm text-[#7FA3D4] transition-colors hover:bg-white/10 hover:text-[#D0E2F4]"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <span className="font-serif text-[18px] leading-none tracking-tight text-sidebar-active">
          Nat Life
        </span>
      </header>

      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer mobile off-canvas */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out-quart md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
            className="absolute right-2 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-sm text-[#7FA3D4] transition-colors hover:bg-white/10 hover:text-[#D0E2F4]"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <SidebarContent userEmail={userEmail} />
        </div>
      </div>
    </>
  );
}
