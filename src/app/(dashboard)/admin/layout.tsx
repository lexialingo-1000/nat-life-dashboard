import { notFound } from 'next/navigation';
import { getCurrentRole } from '@/lib/auth/role';

// Paramètres et Utilisateurs : admins seulement. Les actions de ces pages appellent aussi requireAdmin().
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if ((await getCurrentRole()) !== 'admin') notFound();
  return children;
}
