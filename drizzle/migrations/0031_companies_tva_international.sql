-- dashboard-22 (retour JC 2026-06-10) : N° TVA international sur sociétés étrangères,
-- distinct du N° TVA intracom. Optionnel (nullable).
ALTER TABLE "companies" ADD COLUMN "tva_international" varchar(30);
