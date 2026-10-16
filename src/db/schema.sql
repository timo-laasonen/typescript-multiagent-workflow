-- uses PostgreSQL’s pgvector extension. It stores embedding vectors alongside regular relational data 
-- and supports both exact and approximate nearest-neighbor search.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_chunks (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    document_id TEXT NOT NULL,
    title       TEXT NOT NULL,
    source_uri  TEXT NOT NULL,
    chunk_no    INTEGER NOT NULL,
    content     TEXT NOT NULL,
    embedding   VECTOR(1536) NOT NULL, -- https://developers.openai.com/api/reference/resources/embeddings/methods/create
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (tenant_id, document_id, chunk_no)
);

CREATE INDEX IF NOT EXISTS document_chunks_tenant_idx
    ON document_chunks (tenant_id);

CREATE INDEX IF NOT EXISTS document_chunks_document_idx
    ON document_chunks (tenant_id, document_id);

-- Lisää vasta tarvittaessa suurten aineistojen optimointiin.
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops);
