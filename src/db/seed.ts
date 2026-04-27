import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema';

/**
 * Seeds idempotents pour V1 — réexécutable sans dupliquer.
 *
 * Données validées via recherche-entreprises.api.gouv.fr le 2026-04-27.
 * KAPIMMO bien : non seedé (à saisir manuellement par Natacha plus tard).
 */

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql, { schema });

  console.log('[seed] starting...');

  await seedCompanies(db);
  await seedDocumentTypes(db);
  await seedValroseProperties(db);

  await sql.end();
  console.log('[seed] done.');
}

async function seedCompanies(db: ReturnType<typeof drizzle<typeof schema>>) {
  const companies: schema.NewCompany[] = [
    {
      name: 'FKA',
      siren: '752116103',
      type: 'commerciale',
      formeJuridique: 'sarl',
      address: "Les Jardins d'Anthéa, 10 T avenue Maréchal de Lattre de Tassigny, 13090 Aix-en-Provence",
      activitePrincipale: 'Conseil pour les affaires et autres conseils de gestion',
      nafCode: '70.22Z',
    },
    {
      name: 'Valrose',
      siren: '814952040',
      type: 'immobiliere',
      formeJuridique: 'sas',
      address: '10 T avenue Maréchal de Lattre de Tassigny, 13090 Aix-en-Provence',
      activitePrincipale: 'Location de terrains et autres biens immobiliers',
      nafCode: '68.20B',
    },
    {
      name: 'KAPIMMO',
      siren: '102418530',
      type: 'immobiliere',
      formeJuridique: 'sas',
      address: '10 avenue Maréchal de Lattre de Tassigny, 13090 Aix-en-Provence',
      activitePrincipale: 'Marchand de biens immobiliers',
      nafCode: '68.10Z',
    },
    {
      name: 'LMNP PERSO',
      siren: null,
      type: 'immobiliere',
      formeJuridique: 'indivision',
      address: null,
      activitePrincipale: 'Loueur Meublé Non Professionnel',
      nafCode: null,
    },
    {
      name: 'TRAMEXIA',
      siren: '102453438',
      type: 'commerciale',
      formeJuridique: 'sas',
      address: '10 avenue Maréchal de Lattre de Tassigny, 13090 Aix-en-Provence',
      activitePrincipale: 'Ingénierie, études techniques (bureau d\'étude textile)',
      nafCode: '71.12B',
    },
    {
      name: 'HEPHALAB',
      siren: '999641632',
      type: 'commerciale',
      formeJuridique: 'sas',
      address: '835 allée des Sardenas, 13250 Cornillon-Confoux',
      activitePrincipale: 'Fabrication d\'articles en matières plastiques',
      nafCode: '22.29A',
    },
  ];

  for (const c of companies) {
    const existing = await db.select().from(schema.companies).where(eq(schema.companies.name, c.name)).limit(1);
    if (existing.length === 0) {
      await db.insert(schema.companies).values(c);
      console.log(`[seed] inserted company ${c.name}`);
    } else {
      console.log(`[seed] company ${c.name} already exists, skipping`);
    }
  }
}

async function seedDocumentTypes(db: ReturnType<typeof drizzle<typeof schema>>) {
  const types: schema.NewDocumentType[] = [
    // SUPPLIER
    { code: 'kbis', label: 'KBis', scope: 'supplier', sortOrder: 10, hasExpiration: false },
    { code: 'responsabilite_civile', label: 'Responsabilité civile', scope: 'supplier', sortOrder: 20, hasExpiration: true },
    { code: 'garantie_decennale', label: 'Garantie décennale', scope: 'supplier', sortOrder: 30, hasExpiration: true },
    { code: 'rib', label: 'RIB', scope: 'supplier', sortOrder: 40, hasExpiration: false },
    { code: 'contrat_cadre', label: 'Contrat cadre', scope: 'supplier', sortOrder: 50, hasExpiration: false },
    { code: 'autre', label: 'Autre', scope: 'supplier', sortOrder: 99, hasExpiration: false },

    // CUSTOMER
    { code: 'piece_identite', label: "Pièce d'identité", scope: 'customer', sortOrder: 10, hasExpiration: true },
    { code: 'kbis', label: 'KBis', scope: 'customer', sortOrder: 20, hasExpiration: false },
    { code: 'autre', label: 'Autre', scope: 'customer', sortOrder: 99, hasExpiration: false },

    // PROPERTY
    { code: 'offre_achat', label: "Offre d'achat", scope: 'property', sortOrder: 10, hasExpiration: false },
    { code: 'compromis_achat', label: 'Compromis d\'achat', scope: 'property', sortOrder: 20, hasExpiration: false },
    { code: 'acte_achat', label: 'Acte d\'achat', scope: 'property', sortOrder: 30, hasExpiration: false },
    { code: 'compromis_vente', label: 'Compromis de vente', scope: 'property', sortOrder: 40, hasExpiration: false },
    { code: 'acte_vente', label: 'Acte de vente', scope: 'property', sortOrder: 50, hasExpiration: false },
    { code: 'reglement_copro', label: 'Règlement de copropriété', scope: 'property', sortOrder: 60, hasExpiration: false },
    { code: 'pv_ag', label: "PV d'assemblée générale", scope: 'property', sortOrder: 70, hasExpiration: false },
    { code: 'autre', label: 'Autre', scope: 'property', sortOrder: 99, hasExpiration: false },

    // LOT
    { code: 'diagnostique', label: 'Diagnostic', scope: 'lot', sortOrder: 10, hasExpiration: true },
    { code: 'photo', label: 'Photo', scope: 'lot', sortOrder: 20, hasExpiration: false },
    { code: 'autre', label: 'Autre', scope: 'lot', sortOrder: 99, hasExpiration: false },

    // MARCHE
    { code: 'devis', label: 'Devis', scope: 'marche', sortOrder: 10, hasExpiration: false },
    { code: 'contrat_signe', label: 'Contrat signé', scope: 'marche', sortOrder: 20, hasExpiration: false },
    { code: 'facture_acompte', label: "Facture d'acompte", scope: 'marche', sortOrder: 30, hasExpiration: false },
    { code: 'facture_solde', label: 'Facture de solde', scope: 'marche', sortOrder: 40, hasExpiration: false },
    { code: 'photo_avant', label: 'Photo avant', scope: 'marche', sortOrder: 50, hasExpiration: false },
    { code: 'photo_apres', label: 'Photo après', scope: 'marche', sortOrder: 60, hasExpiration: false },
    { code: 'autre', label: 'Autre', scope: 'marche', sortOrder: 99, hasExpiration: false },

    // LOCATION (V2)
    { code: 'bail', label: 'Bail (template)', scope: 'location', sortOrder: 10, hasExpiration: false },
    { code: 'bail_signe', label: 'Bail signé', scope: 'location', sortOrder: 20, hasExpiration: false },
    { code: 'etat_lieux_entree', label: "État des lieux d'entrée", scope: 'location', sortOrder: 30, hasExpiration: false },
    { code: 'etat_lieux_sortie', label: 'État des lieux de sortie', scope: 'location', sortOrder: 40, hasExpiration: false },
    { code: 'autre', label: 'Autre', scope: 'location', sortOrder: 99, hasExpiration: false },
  ];

  for (const t of types) {
    const existing = await db
      .select()
      .from(schema.documentTypes)
      .where(eq(schema.documentTypes.code, t.code));
    const matching = existing.find((e) => e.scope === t.scope);
    if (!matching) {
      await db.insert(schema.documentTypes).values(t);
      console.log(`[seed] inserted document_type ${t.scope}/${t.code}`);
    }
  }
}

async function seedValroseProperties(db: ReturnType<typeof drizzle<typeof schema>>) {
  const valrose = await db
    .select()
    .from(schema.companies)
    .where(eq(schema.companies.name, 'Valrose'))
    .limit(1);
  if (valrose.length === 0) {
    console.log('[seed] Valrose not found, skipping properties');
    return;
  }
  const valroseId = valrose[0].id;

  const properties = [
    { name: 'CABASSOLS', type: 'immeuble' as const, lots: ['RDC Appartement', 'R+1 Appartement'] },
    { name: 'MALAKOFF', type: 'appartement' as const, lots: ['Appartement'] },
    { name: 'CHALET PERCHÉ', type: 'maison' as const, lots: ['Chalet Perché'] },
    { name: 'BRUNET 43', type: 'maison' as const, lots: ['Brunet 43'] },
    { name: 'BOCAGE', type: 'garage' as const, lots: ['Garage Bocage'] },
  ];

  for (const p of properties) {
    const existing = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.name, p.name))
      .limit(1);
    let propId: string;
    if (existing.length === 0) {
      const inserted = await db
        .insert(schema.properties)
        .values({
          companyId: valroseId,
          name: p.name,
          type: p.type,
        })
        .returning({ id: schema.properties.id });
      propId = inserted[0].id;
      console.log(`[seed] inserted property ${p.name}`);
    } else {
      propId = existing[0].id;
      console.log(`[seed] property ${p.name} already exists, skipping`);
    }

    for (const lotName of p.lots) {
      const existingLot = await db
        .select()
        .from(schema.lots)
        .where(eq(schema.lots.name, lotName))
        .limit(1);
      const matchingLot = existingLot.find((l) => l.propertyId === propId);
      if (!matchingLot) {
        const lotType = p.type === 'immeuble' ? 'appartement' : p.type;
        await db.insert(schema.lots).values({
          propertyId: propId,
          name: lotName,
          type: lotType,
          status: 'vacant',
        });
        console.log(`[seed] inserted lot ${p.name}/${lotName}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('[seed] FAILED', err);
  process.exit(1);
});
