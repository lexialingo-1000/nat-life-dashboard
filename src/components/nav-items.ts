import {
  Building2,
  Users,
  UserCircle,
  LayoutDashboard,
  Hammer,
  Settings,
  Briefcase,
  HardHat,
  KeyRound,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<any>;
  children?: { href: string; label: string }[];
}

/**
 * Structure de navigation partagée entre la sidebar desktop (sidebar.tsx)
 * et le shell mobile (mobile-tab-bar.tsx + mobile-more-sheet.tsx).
 * Source de vérité unique — ne pas dupliquer.
 */
export const sections: { title: string; items: NavItem[] }[] = [
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
