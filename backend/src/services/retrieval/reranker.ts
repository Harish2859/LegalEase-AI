import { CohereClient } from "cohere-ai";

export const rerankChunks = async (query: string, chunks: any[]) => {
  if (chunks.length === 0) return [];

  const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

  const response = await cohere.rerank({
    model: "rerank-english-v3.0",
    query,
    documents: chunks.map(c => c.content),
    topN: 5,
  });

  return response.results
    .filter(result => result.relevanceScore > 0.3)
    .map(result => ({
      ...chunks[result.index],
      rerankScore: result.relevanceScore,
    }));
};
