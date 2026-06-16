-- Migration 0016 — V1.9
-- Ajoute le type de document "Plan" pour scope property (onglet PLANS sur fiche bien).
-- Source : Remarques clients dashboard 10 §"Biens immobilier" — Natacha demande
-- "Rajouter l'onglet PLANS qui sera accessible ensuite aux prestataires".
-- MVP : juste l'onglet upload/list. L'accès prestataire viendra dans une vague suivante.
-- ⚠ Appliquer via Supabase MCP avant le deploy Coolify correspondant.

INSERT INTO "document_types" ("code", "label", "scope", "sort_order", "has_expiration", "is_active")
VALUES ('plan', 'Plan', 'property', 95, false, true)
ON CONFLICT (code, scope) DO NOTHING;
