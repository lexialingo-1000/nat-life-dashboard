/**
 * Titre de section au sein d'une carte / d'un onglet (h2).
 * Plus visible que l'ancien "eyebrow" (10px uppercase) — taille 15px en casse normale,
 * pour que la catégorie soit clairement identifiée comme un titre de section.
 *
 * Utilisé dans les cartes Identité / Notaire / Coordonnées / etc. des fiches détail
 * (sociétés, fournisseurs, clients, biens, lots, marchés, locations).
 */
export function SectionTitle({
  children,
  className,
  as: Tag = 'h2',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
}) {
  return (
    <Tag
      className={`mb-4 text-[15px] font-medium tracking-tight text-zinc-900 ${className ?? ''}`}
    >
      {children}
    </Tag>
  );
}
