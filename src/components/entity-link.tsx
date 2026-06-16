import type { ReactNode } from 'react';

interface Props {
  href: string;
  className?: string;
  title?: string;
  children: ReactNode;
}

// Lien plein page (`<a href>` natif, pas de soft-nav). Le panneau latéral
// `@sheet` introduit en V1.2 a été définitivement supprimé en V12bis PR7 :
// la fiche se rend toujours en pleine page, sur toutes les entités.
export function EntityLink({ href, className, title, children }: Props) {
  return (
    <a href={href} className={className} title={title}>
      {children}
    </a>
  );
}
