-- Drop existing HNSW index
DROP INDEX IF EXISTS kb_chunks_embedding_idx;

-- Recreate HNSW index with optimal parameters for performance
-- m=16: Maximum number of connections per layer (good balance between recall and speed)
-- ef_construction=64: Size of dynamic candidate list for constructing the graph (higher = better quality, slower build)
CREATE INDEX kb_chunks_embedding_idx ON kb_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
