-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Alter the embedding column to use vector type
-- First drop the column and recreate it since we can't cast bytea to vector directly
ALTER TABLE kb_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE kb_chunks ADD COLUMN embedding vector(1536);

-- Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx ON kb_chunks USING hnsw (embedding vector_cosine_ops);
