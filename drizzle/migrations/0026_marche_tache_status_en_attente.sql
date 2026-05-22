-- V1.13 R5 — Statut "En attente" sur tâches de marché
-- Source : Remarques client dashboard-17 §"Rajouter le statut"
-- Cliente : "Rajouter le statut EN ATTENTE avant le statut A FAIRE"
-- Liste finale : EN ATTENTE, A FAIRE, EN COURS, TERMINE, VALIDE.
--
-- Postgres >= 12 requis pour ADD VALUE ... BEFORE (Supabase = OK).
-- Hors transaction Drizzle (Postgres exige ALTER TYPE en standalone) : la
-- runner Drizzle gère cela automatiquement avec `--single-statement` ou en
-- exécutant chaque statement séparément.

ALTER TYPE marche_tache_status ADD VALUE IF NOT EXISTS 'en_attente' BEFORE 'a_faire';
