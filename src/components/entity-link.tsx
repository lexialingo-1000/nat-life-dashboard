import type { ReactNode } from 'react';

interface Props {
  href: string;
  className?: string;
  title?: string;
  children: ReactNode;
}

/**
 * V11 (Natacha §U2) : on supprime le panneau latéral à l'aperçu. Avant, le
 * simple clic utilisait `<Link>` Next → l'intercepting route `@sheet/(.)entity/[id]`
 * ouvrait un panel latéral, le double-clic forçait `window.location.assign`
 * pour atterrir sur la fiche complète.
 *
 * Désormais : simple clic = `<a href>` natif → full navigation, contourne
 * l'intercept @sheet, on arrive directement sur la fiche. Le double-clic
 * n'est plus nécessaire. Les routes `@sheet/(.)…` deviennent du dead code
 * (à supprimer dans un cleanup ultérieur).
 */
export function EntityLink({ href, className, title, children }: Props) {
  return (
    <a href={href} className={className} title={title}>
      {children}
    </a>
  );
}
