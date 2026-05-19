import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { ingestDocument } from '../services/ingestion';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';

export default async function uploadRoute(app: FastifyInstance) {
  app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB

  app.post('/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    // Write to a temp file so LlamaParse can read it from disk
    const tmpPath = path.join(os.tmpdir(), `legalease_${Date.now()}_${data.filename}`);
    await pipeline(data.file, fs.createWriteStream(tmpPath));

    try {
      const fileBuffer = fs.readFileSync(tmpPath);
      console.log(`Ingesting: ${data.filename} (${fileBuffer.length} bytes)`);

      const { document, chunkCount } = await ingestDocument(tmpPath, fileBuffer, 'default-user');

      console.log(`Document ingested: ${document.id} — ${chunkCount} chunks`);
      return reply.send({ documentId: document.id, filename: data.filename, chunkCount });
    } finally {
      fs.unlink(tmpPath, () => {}); // cleanup temp file
    }
  });
}
