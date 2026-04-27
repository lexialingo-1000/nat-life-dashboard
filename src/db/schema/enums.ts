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

export const finitionStatusEnum = pgEnum('finition_status', ['a_faire', 'en_cours', 'livre']);

export const userRoleEnum = pgEnum('user_role', ['admin', 'gestionnaire']);
