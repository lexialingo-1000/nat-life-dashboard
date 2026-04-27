import { Construction } from 'lucide-react';

export function PlaceholderPage({
  title,
  description,
  lot,
}: {
  title: string;
  description: string;
  lot: 'V1.5' | 'V2' | 'V3' | 'À venir';
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="card p-12 text-center">
        <Construction className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-4 text-base font-medium text-slate-700">
          Cette section arrive en {lot}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}
