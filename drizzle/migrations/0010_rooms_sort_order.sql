-- Migration 0010 — V1.7
-- Ajoute sort_order sur rooms pour le drag & drop dans l'onglet Niveaux & Pièces.
-- ⚠ Appliquer via Supabase MCP avant le deploy Coolify correspondant.

ALTER TABLE "rooms"
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint

-- Initialise sort_order selon l'ordre de création (createdAt) au sein de chaque niveau.
UPDATE "rooms" r
SET "sort_order" = sub.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY level_id ORDER BY created_at) - 1) * 10 AS rn
  FROM rooms
) sub
WHERE r.id = sub.id;
