-- dashboard-22 #8b : scoper un type de document (scope=company) par type de société.
-- NULL = toutes les sociétés ; sinon une valeur de l'enum company_type
-- (commerciale_bilan / commerciale_sans_bilan / immobiliere_bilan / immobiliere_sans_bilan).
ALTER TABLE "document_types" ADD COLUMN "applies_to_company_type" text;
