import { SidebarContent } from './sidebar';

/**
 * Enveloppe responsive de la sidebar.
 * - Desktop (md+) : sidebar statique, comportement V1 inchangé.
 * - Mobile (<md)  : topbar simple (logo) — la navigation passe par la
 *   bottom tab bar + sheet « Plus » (mobile-tab-bar.tsx), plus de drawer.
 */
export function SidebarShell({ userEmail }: { userEmail: string | null }) {
  return (
    <>
      {/* Sidebar desktop — flux normal, masquée sur mobile */}
      <div className="hidden h-screen shrink-0 md:flex">
        <SidebarContent userEmail={userEmail} />
      </div>

      {/* Topbar mobile — masquée sur desktop */}
      <header className="flex h-14 shrink-0 items-center justify-center bg-sidebar px-4 text-sidebar-fg md:hidden">
        <span className="font-serif text-[18px] leading-none tracking-tight text-sidebar-active">
          Nat Life
        </span>
      </header>
    </>
  );
}
