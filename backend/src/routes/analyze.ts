import { FastifyInstance } from 'fastify';
import { graph } from '../agents/graph';

export default async function analyzeRoute(app: FastifyInstance) {
  app.post('/analyze', async (request, reply) => {
    const { query } = request.body as { query: string; documentId: string };

    if (!query) {
      return reply.status(400).send({ error: 'query is required' });
    }

    console.log(`Starting Agentic Analysis for: "${query}"`);

    const finalState = await graph.invoke({
      query,
      retryCount: 0,
      retrievedChunks: [],
      redFlags: [],
    });

    return reply.send({
      answer: finalState.answer,
      sources: finalState.sources,
      retryCount: finalState.retryCount,
    });
  });
}
