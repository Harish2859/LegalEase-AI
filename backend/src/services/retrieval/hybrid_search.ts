import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const K_CONSTANT = 60;

export const hybridSearch = async (
  queryText: string,
  queryEmbedding: number[],
  topK: number = 10
) => {
  return await prisma.$queryRawUnsafe(
    `
    WITH vector_search AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) AS rank
      FROM "Chunk"
      WHERE "chunkType" = 'child'
      LIMIT 50
    ),
    keyword_search AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank(content_tsv, plainto_tsquery('english', $2)) DESC) AS rank
      FROM "Chunk"
      WHERE content_tsv @@ plainto_tsquery('english', $2)
      LIMIT 50
    )
    SELECT
      c.id,
      c.content,
      c."chunkType",
      c."sectionTitle",
      c."clauseType",
      c."parentChunkId",
      c."documentId",
      COALESCE(1.0 / (${K_CONSTANT} + v.rank), 0.0) +
      COALESCE(1.0 / (${K_CONSTANT} + k.rank), 0.0) AS rrf_score
    FROM "Chunk" c
    LEFT JOIN vector_search v ON c.id = v.id
    LEFT JOIN keyword_search k ON c.id = k.id
    WHERE v.id IS NOT NULL OR k.id IS NOT NULL
    ORDER BY rrf_score DESC
    LIMIT ${topK}
    `,
    `[${queryEmbedding.join(',')}]`,
    queryText
  );
};
