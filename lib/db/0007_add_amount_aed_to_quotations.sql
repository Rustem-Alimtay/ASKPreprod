ALTER TABLE "requisition_quotations" ADD COLUMN IF NOT EXISTS "amount_aed" numeric(12, 2);
UPDATE "requisition_quotations" SET "amount_aed" = 0 WHERE "amount_aed" IS NULL;
ALTER TABLE "requisition_quotations" ALTER COLUMN "amount_aed" SET NOT NULL;
