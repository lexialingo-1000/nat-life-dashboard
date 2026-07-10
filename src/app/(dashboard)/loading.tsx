/**
 * Skeleton global du dashboard — affiché pendant le fetch server component
 * de n'importe quelle route enfant sans loading.tsx propre. Avant : écran
 * figé sans feedback pendant les navigations lentes (mobile notamment).
 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true" aria-label="Chargement">
      <div className="space-y-3">
        <div className="h-3 w-28 rounded bg-zinc-200/70" />
        <div className="h-8 w-64 rounded bg-zinc-200/70" />
        <div className="h-3 w-96 max-w-full rounded bg-zinc-200/50" />
      </div>
      <div className="card space-y-4 p-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-1/4 rounded bg-zinc-200/70" />
            <div className="h-4 w-1/3 rounded bg-zinc-200/50" />
            <div className="ml-auto h-4 w-16 rounded bg-zinc-200/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
