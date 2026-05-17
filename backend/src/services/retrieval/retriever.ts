import { PrismaClient } from '@prisma/client';
import { generateEmbedding } from '../ingestion/embeddings';
import { hybridSearch } from './hybrid_search';
import { rerankChunks } from './reranker';
import { expandQuery } from './expansion';

const prisma = new PrismaClient();

export const retrieve = async (query: string) => {
  // 1. HyDE + Query Expansion — generate hypothesis & keywords
  const { hypothesis, keywords } = await expandQuery(query);

  // 2. Embed the hypothesis (HyDE core — match answer-to-answer, not question-to-answer)
  const queryEmbedding = await generateEmbedding(hypothesis);

  // 3. Hybrid search — vector uses hypothesis embedding, keyword uses expanded terms
  const keywordQuery = keywords.join(' ');
  const candidates = await hybridSearch(keywordQuery, queryEmbedding, 50) as any[];

  // 4. Rerank — filters to top 5 most relevant child chunks
  const reranked = await rerankChunks(query, candidates);

  if (reranked.length === 0) return [];

  // 5. Parent fetch — get full legal sections for each child
  const parentIds = [...new Set(reranked.map((c: any) => c.parentChunkId).filter(Boolean))];

  const parents = await prisma.chunk.findMany({
    where: { id: { in: parentIds as string[] } },
    select: { id: true, content: true, sectionTitle: true },
  });

  const parentMap = Object.fromEntries(parents.map(p => [p.id, p]));

  // 6. Attach parent context to each result
  return reranked.map((chunk: any) => ({
    ...chunk,
    parentContent: parentMap[chunk.parentChunkId]?.content ?? null,
    parentSectionTitle: parentMap[chunk.parentChunkId]?.sectionTitle ?? null,
  }));
};
