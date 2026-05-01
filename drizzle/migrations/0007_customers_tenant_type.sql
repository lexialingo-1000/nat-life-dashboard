CREATE TYPE "tenant_type" AS ENUM ('LT', 'CT');
--> statement-breakpoint

ALTER TABLE "customers" ADD COLUMN "tenant_type" "tenant_type";
--> statement-breakpoint

COMMENT ON COLUMN "customers"."tenant_type" IS
  'NULL = client B2B non-locataire ; LT = locataire long terme (bail) ; CT = locataire court terme (saisonnier)';
