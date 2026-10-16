
import { pool } from "../db/pool.ts";
import { createEmbedding } from "./embeddings.ts";

export interface SourceDocument {
  tenantId: string;
  id: string;
  title: string;
  uri: string;
  text: string;
}

// Splits a text into smaller chunks with optional overlap between chunks.

export function splitText(
  text: string,
  chunkSize = 3000,
  overlap = 300,
): string[] {
  if (
    chunkSize <= 0 ||
    overlap < 0 ||
    overlap >= chunkSize
  ) {
    throw new Error("Invalid text chunk settings");
  }

  const normalized = text.trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  const step = chunkSize - overlap;

  for (let start = 0; start < normalized.length; start += step) {
    const chunk = normalized.slice(start, start + chunkSize).trim();
    if (chunk) chunks.push(chunk);
  }

  return chunks;
}

// Indexes a document by splitting it into chunks, creating embeddings for each chunk, and storing them in the database.

export async function indexDocument(
  doc: SourceDocument,
): Promise<number> {
  const chunks = splitText(doc.text);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Delete the old version of the same document.
    await client.query(
      `DELETE FROM document_chunks
       WHERE tenant_id = $1 AND document_id = $2`,
      [doc.tenantId, doc.id],
    );

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await createEmbedding(chunks[i]);
      const vectorLiteral = `[${embedding.join(",")}]`;

      await client.query(
        `INSERT INTO document_chunks
          (tenant_id, document_id, title, source_uri,
           chunk_no, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7::vector)`,
        [
          doc.tenantId,
          doc.id,
          doc.title,
          doc.uri,
          i,
          chunks[i],
          vectorLiteral,
        ],
      );
    }

    await client.query("COMMIT");
    return chunks.length;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
