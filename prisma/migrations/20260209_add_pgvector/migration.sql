-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Alter the embedding column to use vector type
ALTER TABLE kb_chunks ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector(1536);

-- Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx ON kb_chunks USING hnsw (embedding vector_cosine_ops);
