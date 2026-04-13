ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_parent_id_fkey";
ALTER TABLE "departments" DROP COLUMN IF EXISTS "budget_owner_id";
ALTER TABLE "departments" DROP COLUMN IF EXISTS "parent_id";
