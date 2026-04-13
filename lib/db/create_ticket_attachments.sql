CREATE TABLE IF NOT EXISTS "ticket_attachments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" varchar NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "filename" varchar NOT NULL,
  "file_type" varchar NOT NULL,
  "file_size" integer NOT NULL,
  "file_data" text NOT NULL,
  "uploaded_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ticket_attachments_ticket_idx" ON "ticket_attachments" ("ticket_id");
