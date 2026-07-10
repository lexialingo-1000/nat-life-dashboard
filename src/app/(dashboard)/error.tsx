'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * Error boundary global du dashboard. Sans lui, toute erreur serveur non
 * rattrapée affichait l'écran Next.js générique « Application error: a
 * client-side exception has occurred » sans issue pour l'utilisatrice.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('[dashboard] unhandled error', error);
  }, [error]);

  return (
    <div className="card mx-auto mt-12 max-w-lg p-8 text-center">
      <AlertCircle className="mx-auto h-8 w-8 text-red-500" strokeWidth={1.5} />
      <h2 className="mt-4 text-[17px] font-medium text-zinc-900">Une erreur est survenue</h2>
      <p className="mt-2 text-[13px] text-zinc-500">
        L'action n'a pas pu aboutir. Réessaie, ou reviens à l'accueil si le problème persiste.
        {error.digest && (
          <span className="mt-1 block font-mono text-[11px] text-zinc-400">
            Réf. {error.digest}
          </span>
        )}
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn-primary inline-flex items-center gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
          Réessayer
        </button>
        <a href="/" className="btn-secondary">
          Accueil
        </a>
      </div>
    </div>
  );
}
