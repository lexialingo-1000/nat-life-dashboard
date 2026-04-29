import { db } from '@/db/client';
import { companies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { SheetWrapper } from '@/components/sheet-wrapper';
import { DeleteButton } from '@/components/delete-button';
import { deleteSocieteAction } from '../../../societes/actions';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  commerciale: 'Commerciale',
  immobiliere: 'Immobilière',
};

const FORME_LABELS: Record<string, string> = {
  sas: 'SAS',
  sarl: 'SARL',
  sci: 'SCI',
  indivision: 'Indivision',
  eurl: 'EURL',
  sa: 'SA',
  auto_entrepreneur: 'Auto-entrepreneur',
  autre: 'Autre',
};

export default async function SocieteSheetPage({ params }: { params: { id: string } }) {
  const rows = await db.select().from(companies).where(eq(companies.id, params.id)).limit(1);
  if (rows.length === 0) notFound();
  const c = rows[0];

  return (
    <SheetWrapper key={c.id} fullPageHref={`/societes/${c.id}`}>
      <div className={c.isActive ? '' : 'opacity-75'}>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Société
        </div>
        <h1 className="mt-1.5 flex items-baseline gap-3 text-[24px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">{c.name}</span>
          {!c.isActive && <span className="badge-neutral">Inactive</span>}
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500">
          {TYPE_LABELS[c.type] ?? c.type}
          {c.formeJuridique ? ` · ${FORME_LABELS[c.formeJuridique] ?? c.formeJuridique}` : ''}
        </p>

        <div className="mt-6 space-y-4">
          <Block label="SIREN">
            <span className="font-mono text-[12px] tnum text-zinc-700">{c.siren ?? '—'}</span>
          </Block>
          <Block label="Code NAF">
            <span className="font-mono text-[12px] text-zinc-700">{c.nafCode ?? '—'}</span>
          </Block>
          <Block label="Activité">{c.activitePrincipale ?? '—'}</Block>
          <Block label="Siège">{c.address ?? '—'}</Block>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-zinc-200 pt-6">
          <a
            href={`/societes/${c.id}/edit`}
            className="btn-secondary inline-flex items-center justify-center"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Modifier
          </a>
          <DeleteButton
            action={deleteSocieteAction}
            id={c.id}
            label="Supprimer"
            confirmationPhrase={c.name}
            description={`Cette action est irréversible. La société "${c.name}" sera supprimée.`}
          />
        </div>
      </div>
    </SheetWrapper>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zinc-700">{children}</div>
    </div>
  );
}
