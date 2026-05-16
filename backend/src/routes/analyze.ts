import { FastifyInstance } from 'fastify';

export default async function analyzeRoute(app: FastifyInstance) {
  app.post('/analyze', async (request, reply) => {
    // TODO: invoke LangGraph pipeline
    return reply.send({ status: 'ok' });
  });
}
