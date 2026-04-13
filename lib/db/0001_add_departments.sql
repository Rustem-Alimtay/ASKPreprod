CREATE TABLE IF NOT EXISTS "departments" (
        "internal_id" integer PRIMARY KEY NOT NULL,
        "external_id" varchar NOT NULL,
        "name" varchar NOT NULL,
        "inactive" boolean DEFAULT false NOT NULL
);
