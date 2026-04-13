ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "requester_full_name" varchar;
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "requester_position" varchar;
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "requester_department" varchar;
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "requester_cost_center" varchar;
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "requester_cost_center_account_number" varchar;
