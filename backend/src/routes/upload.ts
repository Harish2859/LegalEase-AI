import { FastifyInstance } from 'fastify';

export default async function uploadRoute(app: FastifyInstance) {
  app.post('/upload', async (request, reply) => {
    // TODO: trigger ingestion pipeline
    return reply.send({ status: 'ok' });
  });
}
