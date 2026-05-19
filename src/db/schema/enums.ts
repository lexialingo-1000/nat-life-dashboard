import { pgEnum } from 'drizzle-orm/pg-core';

export const companyTypeEnum = pgEnum('company_type', ['commerciale', 'immobiliere']);

export const formeJuridiqueEnum = pgEnum('forme_juridique', [
  'sas',
  'sarl',
  'sci',
  'indivision',
  'eurl',
  'sa',
  'auto_entrepreneur',
  'autre',
]);

export const supplierInvoicingTypeEnum = pgEnum('supplier_invoicing_type', [
  'pennylane',
  'email_forward',
  'scraping_required',
  'manual_upload',
]);

export const documentScopeEnum = pgEnum('document_scope', [
  'company',
  'supplier',
  'customer',
  'property',
  'lot',
  'marche',
  'marche_lot',
  'location',
]);

export const propertyTypeEnum = pgEnum('property_type', [
  'appartement',
  'maison',
  'garage',
  'immeuble',
  'terrain',
]);

// V1.9 : split 'loue_ou_vacant' en 'loue' + 'vacant' (Natacha — statuts distincts).
// Migration SQL : drizzle/migrations/0015_property_statut_split.sql.
// V1.11 hotfix : ajout 'en_portefeuille' + 'en_cours_de_vente' (déjà présents en
// prod DB, ajoutés manuellement précédemment ; le schéma canonique était en
// retard et bloquait le build Coolify). Aligne TS sur la réalité prod.
export const propertyStatutEnum = pgEnum('property_statut', [
  'en_cours_acquisition',
  'en_portefeuille',
  'loue',
  'vacant',
  'en_cours_de_vente',
  'vendu',
]);

export const lotStatusEnum = pgEnum('lot_status', [
  'vacant',
  'loue_annuel',
  'loue_saisonnier',
  'travaux',
]);

export const marcheStatusEnum = pgEnum('marche_status', [
  'devis_recu',
  'signe',
  'en_cours',
  'livre',
  'conteste',
  'annule',
]);

export const locationTypeEnum = pgEnum('location_type', [
  'bail_meuble_annuel',
  'bail_nu_annuel',
  'saisonnier_direct',
  'saisonnier_plateforme',
]);

export const locationPeriodiciteEnum = pgEnum('location_periodicite', [
  'forfait',
  'jour',
  'semaine',
  'mois',
  'annee',
]);

/**
 * Statut d'une tâche de marché (anciennement `finition_status` en V1, renommé V1.8 P2-5).
 *
 * Source : Remarques client dashboard-8 §10 (à faire / en cours / terminé / validé).
 *
 * Migration V1.8 :
 * - `livre` (V1) → renamed to `termine`
 * - `valide` (NEW V1.8) ajouté
 */
export const marcheTacheStatusEnum = pgEnum('marche_tache_status', [
  'a_faire',
  'en_cours',
  'termine',
  'valide',
]);

// V1.9 Lot E — catégorie sur types ET sur documents (override).
// Migration : drizzle/migrations/0017_doc_categories.sql.
export const documentCategoryEnum = pgEnum('document_category', [
  'notaire',
  'banque',
  'juridique',
  'comptabilite',
  'courant',
  'location',
]);

export const userRoleEnum = pgEnum('user_role', ['admin', 'gestionnaire']);

export const tenantTypeEnum = pgEnum('tenant_type', ['LT', 'CT']);

export const supplierTypeEnum = pgEnum('supplier_type', [
  'notaire',
  'banque',
  'juridique',
  'comptabilite',
  'architecte',
  'entrepreneur',
  'syndic',
  'diagnostic',
  'assurance',
  'autre',
]);

// V1.11 R8 — fréquence TVA des sociétés.
// NULL = info pas renseignée ; 'non_assujettie' = explicite ; sinon fréquence.
export const tvaFrequencyEnum = pgEnum('tva_frequency', [
  'non_assujettie',
  'mensuelle',
  'trimestrielle',
  'annuelle',
]);
