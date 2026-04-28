import { ExpirationsWidget } from '@/components/expirations-widget';
import { db } from '@/db/client';
import { companies, suppliers, customers, properties, lots, marchesTravaux } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { Building2, Hammer, UserCircle, Briefcase, HardHat, Home as HomeIcon } from 'lucide-react';
import Link from 'next/link';

async function fetchCounts() {
  try {
    const [c1] = await db.select({ n: sql<number>`count(*)::int` }).from(companies);
    const [c2] = await db.select({ n: sql<number>`count(*)::int` }).from(suppliers);
    const [c3] = await db.select({ n: sql<number>`count(*)::int` }).from(customers);
    const [c4] = await db.select({ n: sql<number>`count(*)::int` }).from(properties);
    const [c5] = await db.select({ n: sql<number>`count(*)::int` }).from(lots);
    const [c6] = await db.select({ n: sql<number>`count(*)::int` }).from(marchesTravaux);
    return {
      societes: c1.n,
      fournisseurs: c2.n,
      clients: c3.n,
      properties: c4.n,
      lots: c5.n,
      marches: c6.n,
    };
  } catch {
    return null;
  }
}

const today = new Date().toLocaleDateString('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export default async function DashboardHome() {
  const counts = await fetchCounts();

  return (
    <div className="space-y-12">
      {/* Hero header */}
      <header>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          {today}
        </div>
        <h1 className="mt-2 text-[40px] font-normal leading-[1.1]">
          <span className="display-serif text-zinc-900">Bonjour.</span>{' '}
          <span className="text-zinc-900">Vue d'ensemble.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-zinc-500">
          Synthèse en temps réel des 6 sociétés gérées par FKA Holding. Périmètre V1 : référentiels,
          patrimoine immobilier et marchés de travaux. Compta différée post-réforme PA (sept 2026).
        </p>
      </header>

      {/* KPIs — featured layout : 2 large + 4 small */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-6">
        <FeaturedKpi
          label="Sociétés"
          value={counts?.societes}
          icon={Briefcase}
          href="/societes"
          accent
        />
        <FeaturedKpi
          label="Lots immobiliers"
          value={counts?.lots}
          sublabel={counts ? `${counts.properties} immeuble${counts.properties > 1 ? 's' : ''}` : undefined}
          icon={HomeIcon}
          href="/biens"
        />
        <Kpi label="Fournisseurs" value={counts?.fournisseurs} icon={Hammer} href="/fournisseurs" />
        <Kpi label="Clients" value={counts?.clients} icon={UserCircle} href="/clients" />
        <Kpi label="Marchés" value={counts?.marches} icon={HardHat} href="/marches" />
        <Kpi label="Immeubles" value={counts?.properties} icon={Building2} href="/biens" />
      </section>

      {/* Expirations widget */}
      <section>
        <SectionHeader
          eyebrow="Vigilance"
          title="Documents arrivant à échéance"
          description="Responsabilité civile, garanties décennales et autres documents fournisseur dont la validité expire dans les 30 prochains jours."
        />
        <div className="mt-5">
          <ExpirationsWidget />
        </div>
      </section>

      {/* Roadmap */}
      <section>
        <SectionHeader
          eyebrow="Feuille de route"
          title="Périmètre & jalons"
          description="État du déploiement. Les modules différés s'appuient sur la base structurelle livrée en V1."
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <RoadmapBlock
            phase="V1"
            status="active"
            title="Socle structurel"
            items={[
              'Référentiels : sociétés, fournisseurs (multi-contacts + docs typés), clients',
              'Patrimoine : Property → Lot → Level → Room',
              'Marchés de travaux + sous-lots techniques + documents catégorisés',
            ]}
          />
          <RoadmapBlock
            phase="V1.5+"
            status="planned"
            title="Modules différés"
            items={[
              'Compta : différée V1.5 post-réforme PA (sept 2026)',
              'Locatif (Rentila replacement) : V2',
              'Saisonnier (Airbnb) : V3',
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="page-header">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
        {eyebrow}
      </div>
      <h2 className="mt-1.5 text-[20px] font-medium tracking-tight text-zinc-900">{title}</h2>
      {description && (
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-500">{description}</p>
      )}
    </div>
  );
}

function FeaturedKpi({
  label,
  value,
  sublabel,
  icon: Icon,
  href,
  accent,
}: {
  label: string;
  value: number | undefined;
  sublabel?: string;
  icon: any;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative col-span-2 row-span-2 flex flex-col justify-between overflow-hidden rounded-sm border bg-[#fbf8f0] p-6 transition-colors duration-200 ease-out-quart hover:border-zinc-300 ${
        accent ? 'border-zinc-300' : 'border-zinc-200'
      }`}
    >
      {accent && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-emerald-500" />
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          {label}
        </span>
        <Icon className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />
      </div>
      <div className="mt-6">
        <div className="display-serif tnum text-[68px] leading-none text-zinc-900">
          {value ?? '—'}
        </div>
        {sublabel && (
          <div className="mt-2 text-[10px] uppercase tracking-wider text-zinc-500">{sublabel}</div>
        )}
      </div>
    </Link>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | undefined;
  icon: any;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-sm border border-zinc-200 bg-[#fbf8f0] p-4 transition-colors duration-200 ease-out-quart hover:border-zinc-300"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.75} />
      </div>
      <div className="mt-3 display-serif tnum text-[34px] leading-none text-zinc-900">
        {value ?? '—'}
      </div>
    </Link>
  );
}

function RoadmapBlock({
  phase,
  status,
  title,
  items,
}: {
  phase: string;
  status: 'active' | 'planned';
  title: string;
  items: string[];
}) {
  const isActive = status === 'active';
  return (
    <div className="card bg-[#fbf8f0] p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-medium text-zinc-900">{title}</h3>
        <span className={isActive ? 'badge-emerald' : 'badge-neutral'}>
          {isActive ? 'En cours' : phase}
        </span>
      </div>
      <ul className="mt-4 space-y-2 text-[13px] leading-relaxed">
        {items.map((item, i) => (
          <li key={i} className="flex items-baseline gap-2.5">
            <span
              className={`inline-block h-1 w-1 shrink-0 translate-y-[-3px] rounded-full ${
                isActive ? 'bg-emerald-500' : 'bg-zinc-300'
              }`}
            />
            <span className={isActive ? 'text-zinc-700' : 'text-zinc-500'}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
