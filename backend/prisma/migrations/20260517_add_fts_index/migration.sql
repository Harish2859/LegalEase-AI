ALTER TABLE "Chunk" ADD COLUMN "content_tsv" tsvector
GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED;

CREATE INDEX "idx_chunks_content_tsv" ON "Chunk" USING GIN ("content_tsv");
