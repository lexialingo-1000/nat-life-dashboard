import { CheckCircle2, AlertCircle } from 'lucide-react';

export interface RequiredDocumentsWidgetProps {
  /** Types de documents marqués obligatoires non encore uploadés. */
  missingTypes: { id: string; label: string }[];
  /** Libellé scope pour la phrase verte (ex : "client", "société"). */
  scopeLabel?: string;
  /** Sous-libellé optionnel pour préciser le contexte (ex : "locataire LT"). */
  hint?: string;
}

export function RequiredDocumentsWidget({
  missingTypes,
  scopeLabel = 'client',
  hint,
}: RequiredDocumentsWidgetProps) {
  if (missingTypes.length === 0) {
    return (
      <div className="card flex items-start gap-3 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" strokeWidth={1.75} />
        <div className="text-[13px]">
          <div className="text-zinc-700">
            Tous les documents requis sont fournis pour ce {scopeLabel}.
          </div>
          {hint && <div className="mt-0.5 text-[12px] text-zinc-500">{hint}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="card border-l-4 border-amber-500 p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-amber-700">
        Documents manquants
      </div>
      {hint && <div className="mt-0.5 text-[12px] text-zinc-500">{hint}</div>}
      <ul className="mt-2 space-y-1.5">
        {missingTypes.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-[13px] text-zinc-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" strokeWidth={2} />
            <span>{t.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-zinc-500">
        Ajoute ces documents depuis l'onglet « Documents ».
      </p>
    </div>
  );
}
