import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function expirationStatus(expiresAt: Date | string | null | undefined): {
  label: string;
  color: 'green' | 'orange' | 'red' | 'gray';
} {
  if (!expiresAt) return { label: '—', color: 'gray' };
  const days = daysUntil(expiresAt);
  if (days === null) return { label: '—', color: 'gray' };
  if (days < 0) return { label: `Expirée depuis ${-days}j`, color: 'red' };
  if (days < 30) return { label: `Expire dans ${days}j`, color: 'orange' };
  return { label: `Valide jusqu'au ${formatDate(expiresAt)}`, color: 'green' };
}
