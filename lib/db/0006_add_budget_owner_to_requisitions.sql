ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "budget_owner_id" varchar;
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "budget_owner_name" varchar;