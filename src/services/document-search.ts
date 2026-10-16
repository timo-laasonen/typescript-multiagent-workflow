
import { pool } from "../db/pool.js";
import { createEmbedding } from "./embeddings.js";

// Here tenantId restricts the search to the data of a single customer or access scope. 
// The value must come from the authenticated user context, not from a query parameter freely provided by the user.
// The SQL query uses parameterized values, which prevents SQL injection. 
// The pgvector documentation also describes the use of cosine distance and HNSW indexing.

// Note: this returns the five nearest text chunks, even if they are not necessarily relevant enough. 
// In production, add a tested relevance threshold, result evaluation and, if needed, reranking. 
// Do not let the model present a weak search result as established fact.

export interface DocumentHit {
  title: string;
  sourceUri: string;
  content: string;
  similarity: number;
}

// Searches for documents similar to the given query within the specified tenant's context. 
// Returns a list of document hits with similarity scores.

export async function searchDocuments(
  tenantId: string,
  query: string,
  limit = 5,
): Promise<DocumentHit[]> {
  if (!tenantId.trim() || !query.trim()) {
    throw new Error("Tenant and query are required");
  }

  const safeLimit = Math.max(1, Math.min(limit, 10));
  const embedding = await createEmbedding(query);
  const vectorLiteral = `[${embedding.join(",")}]`;

  const result = await pool.query<{
    title: string;
    source_uri: string;
    content: string;
    similarity: number;
  }>(
    `SELECT
       title,
       source_uri,
       content,
       1 - (embedding <=> $1::vector) AS similarity
     FROM document_chunks
     WHERE tenant_id = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [vectorLiteral, tenantId, safeLimit],
  );

  return result.rows.map((row) => ({
    title: row.title,
    sourceUri: row.source_uri,
    content: row.content,
    similarity: Number(row.similarity),
  }));
}
