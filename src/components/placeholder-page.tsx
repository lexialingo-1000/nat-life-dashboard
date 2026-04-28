import { Construction } from 'lucide-react';

export function PlaceholderPage({
  title,
  description,
  lot,
  eyebrow = 'Administration',
}: {
  title: string;
  description: string;
  lot: 'V1.5' | 'V2' | 'V3' | 'À venir';
  eyebrow?: string;
}) {
  return (
    <div className="space-y-8">
      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          {eyebrow}
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">{title}</span>
        </h1>
        <p className="mt-1.5 max-w-xl text-[13px] text-zinc-500">{description}</p>
      </header>

      <div className="card p-12 text-center">
        <Construction className="mx-auto h-10 w-10 text-zinc-300" strokeWidth={1.5} />
        <p className="mt-4 text-[13px] font-medium text-zinc-700">
          Cette section arrive en {lot}
        </p>
      </div>
    </div>
  );
}
