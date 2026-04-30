'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

interface Props {
  href: string;
  className?: string;
  title?: string;
  children: ReactNode;
}

/**
 * Lien d'entité destiné aux cellules de liste interceptées par le pattern
 * sheet (`@sheet/(.)entity/[id]`) :
 * - simple-clic : navigation Next.js classique → l'intercepting route ouvre
 *   le panel latéral.
 * - double-clic : `window.location.assign` force un rechargement complet,
 *   contourne l'intercept et atterrit sur la fiche complète.
 */
export function EntityLink({ href, className, title, children }: Props) {
  return (
    <Link
      href={href}
      className={className}
      title={title}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.assign(href);
      }}
    >
      {children}
    </Link>
  );
}
