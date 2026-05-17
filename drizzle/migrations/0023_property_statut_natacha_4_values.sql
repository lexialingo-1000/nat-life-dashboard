-- V12bis PR9 §4 — statut bien : 4 valeurs alignées sur retours Natacha dashboard-13.
-- Natacha veut visibles : "en cours d'acquisition", "en portefeuille", "en cours de vente", "vendu".
-- État avant migration : property_statut = (en_cours_acquisition, loue, vacant, vendu).
-- État cible : property_statut + en_portefeuille + en_cours_de_vente. Les valeurs
-- loue/vacant restent dans l'enum (orphelines, plus exposées dans le form) — drop
-- complet reporté à V1.10 (recréation enum nécessaire). Backfill : les biens en
-- vacant/loue passent en en_portefeuille (décision V12bis PR1 : statut locatif
-- appartient au LOT, pas au BIEN).

ALTER TYPE property_statut ADD VALUE IF NOT EXISTS 'en_portefeuille';
--> statement-breakpoint
ALTER TYPE property_statut ADD VALUE IF NOT EXISTS 'en_cours_de_vente';
--> statement-breakpoint
UPDATE properties SET statut = 'en_portefeuille'
  WHERE statut IN ('vacant', 'loue');
--> statement-breakpoint
ALTER TABLE properties ALTER COLUMN statut SET DEFAULT 'en_portefeuille';
