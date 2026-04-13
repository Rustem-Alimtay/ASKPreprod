-- Add assignedToGroup column to requisition_approval_steps
ALTER TABLE "requisition_approval_steps" ADD COLUMN IF NOT EXISTS "assigned_to_group" varchar;

-- Create requisition_quotations table
CREATE TABLE IF NOT EXISTS "requisition_quotations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "requisition_id" varchar NOT NULL REFERENCES "requisitions"("id") ON DELETE CASCADE,
  "vendor_name" varchar NOT NULL,
  "file_name" varchar,
  "file_type" varchar,
  "file_size" integer,
  "file_data" text,
  "is_recommended" boolean DEFAULT false NOT NULL,
  "comments" text,
  "created_by" varchar,
  "created_at" timestamp DEFAULT now()
);

-- Add index on requisition_id for quotations
CREATE INDEX IF NOT EXISTS "quotations_requisition_idx" ON "requisition_quotations" USING btree ("requisition_id");
