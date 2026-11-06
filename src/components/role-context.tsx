'use client';

import { createContext, useContext } from 'react';

// Rôle du compte connecté, fourni par le layout du dashboard. Sert seulement à masquer
// ce qu'un·e gestionnaire ne peut pas faire : le vrai contrôle est côté serveur (requireAdmin).
const IsAdminContext = createContext(false);

export function RoleProvider({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  return <IsAdminContext.Provider value={isAdmin}>{children}</IsAdminContext.Provider>;
}

export const useIsAdmin = () => useContext(IsAdminContext);
