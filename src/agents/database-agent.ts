
import { Agent, tool } from "@openai/agents";
import { z } from "zod";
import { pool } from "../db/pool.ts";

const model = process.env.OPENAI_MODEL;

if (!model) {
  throw new Error("OPENAI_MODEL missing");
}

/*
The example data model is as follows

CREATE TABLE IF NOT EXISTS business_records (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    record_type TEXT NOT NULL,
    title       TEXT NOT NULL,
    details     TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS business_records_search_idx
    ON business_records (tenant_id, record_type);


The database agent is not given free-form SQL generation or direct access to the entire database. 
Instead, it is given a search tool that executes a single predefined query.

Relevant for security:
- tenantId comes from the server's authenticated user context.
- All SQL values are passed as parameters.
- The search function returns at most 20 records.
- The tool does not allow INSERT, UPDATE, DELETE or arbitrary SQL.
- In production, the database credentials have only the necessary SELECT permissions.

This text search is a simple example. If business questions require exact sums, dates,
calculations or complex conditions, create separate typed tools for them.
Do not try to solve precise database reporting with semantic search alone.
*/

export function createDatabaseAgent(tenantId: string) {
  const searchRecords = tool({
    name: "search_business_records",
    description:
      "Hae sallittuja liiketoimintatietueita " +
      "otsikon ja sisältötekstin perusteella.",
    parameters: z.object({
      searchText: z.string().min(1).max(200),
      recordType: z.string().min(1).max(50).optional(),
    }),
    execute: async ({ searchText, recordType }) => {
      const result = await pool.query(
        `SELECT id, record_type, title, details, updated_at
         FROM business_records
         WHERE tenant_id = $1
           AND ($2::text IS NULL OR record_type = $2)
           AND (
             title ILIKE $3 ESCAPE '\\'
             OR details ILIKE $3 ESCAPE '\\'
           )
         ORDER BY updated_at DESC
         LIMIT 20`,
        [
          tenantId,
          recordType ?? null,
          `%${searchText
            .replace(/[\\%_]/g, "\\$&")}%`,
        ],
      );

      return result.rows;
    },
  });

  return new Agent({
    name: "Tietokanta-asiantuntija",
    model,
    instructions: `
        Olet rakenteisten liiketoimintatietojen asiantuntija.

        - Käytä vain sinulle annettua hakutyökalua.
        - Älä keksi tietueita tai tietokantatuloksia.
        - Erota tietokannasta löytyneet faktat päätelmistä.
        - Kerro, jos haku ei löydä sopivia tietueita.
        - Älä tee muutoksia tietokantaan.
        - Älä pyydä tai paljasta salasanoja tai salaisuuksia.
    `.trim(),
    tools: [searchRecords],
  });
}
