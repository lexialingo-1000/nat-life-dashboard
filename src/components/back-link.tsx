'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Props {
  /** URL fallback si l'historique navigateur est vide (entrée directe par URL). */
  fallbackHref: string;
  /** Texte du lien (souvent le nom de la liste parente, p.ex. "Biens immobiliers"). */
  label: string;
  /** Classes additionnelles. */
  className?: string;
}

/**
 * Lien retour qui privilégie l'historique navigateur (router.back) sur la page parente.
 * Conserve un href fallback pour l'accessibilité (ouvrir dans nouvel onglet, copier le lien)
 * et pour le cas où l'utilisateur arrive par URL directe (history.length <= 1).
 */
export function BackLink({ fallbackHref, label, className }: Props) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Ne rien faire si l'utilisateur fait Cmd/Ctrl+clic ou clic milieu (ouverture nouvel onglet).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <Link
      href={fallbackHref}
      onClick={handleClick}
      className={
        className ??
        'inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-emerald-700'
      }
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
