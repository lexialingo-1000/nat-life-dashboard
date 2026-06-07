'use client';

import { FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';

// dashboard-22 — bouton PDF suivi de travaux (ouvre /api/pdf/suivi-travaux dans un nouvel onglet)

interface Props {
  marcheId?: string;
  lotId?: string;
  supplierId?: string;
  label?: string;
}

export function PdfDownloadButton({
  marcheId,
  lotId,
  supplierId,
  label = 'Télécharger PDF',
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    const params = new URLSearchParams();
    if (marcheId) params.set('marcheId', marcheId);
    else if (lotId) params.set('lotId', lotId);
    else if (supplierId) params.set('supplierId', supplierId);

    setLoading(true);
    const url = `/api/pdf/suivi-travaux?${params}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[12px] text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
      ) : (
        <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
      )}
      {label}
    </button>
  );
}
