import { parseLegalDocument } from './parser';
import { redactPII, generateFileHash } from './redaction';
import { createParentChildChunks } from './chunker';
import { generateEmbedding } from './embeddings';
import { classifyClause } from './classifier';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const ingestDocument = async (filePath: string, fileBuffer: Buffer, userId: string) => {
  const hash = generateFileHash(fileBuffer);

  const existingDoc = await prisma.document.findUnique({ where: { sha256Hash: hash } });
  if (existingDoc) return { document: existingDoc, chunkCount: 0 };

  const parsedPages = await parseLegalDocument(filePath);
  const redactedText = await redactPII(parsedPages.map((p: { text: string; pageNumber: number }) => p.text).join('\n'));

  const document = await prisma.document.create({
    data: {
      userId,
      filename: filePath.split('/').pop() || 'contract.pdf',
      sha256Hash: hash,
      pageCount: parsedPages.length,
      status: 'INGESTING',
    }
  });

  const allChunks = createParentChildChunks(parsedPages);

  // Insert all chunks without embeddings first (Prisma handles non-vector fields)
  await prisma.$transaction(
    allChunks.map(chunk => prisma.chunk.create({
      data: {
        id: chunk.id,
        documentId: document.id,
        content: chunk.content,
        chunkType: chunk.chunkType,
        sectionTitle: chunk.sectionTitle,
        parentChunkId: chunk.parentId,
      }
    }))
  );

  // Embed + classify child chunks only; use raw SQL for pgvector column
  const childChunks = allChunks.filter(c => c.chunkType === 'child');

  await Promise.all(childChunks.map(async (chunk) => {
    const [embedding, clauseType] = await Promise.all([
      generateEmbedding(chunk.content),
      classifyClause(chunk.content),
    ]);

    await prisma.$executeRaw`
      UPDATE "Chunk"
      SET embedding = ${`[${embedding.join(',')}]`}::vector(1024),
          "clauseType" = ${clauseType}
      WHERE id = ${chunk.id}
    `;
  }));

  await prisma.document.update({
    where: { id: document.id },
    data: { status: 'READY' },
  });

  return { document, chunkCount: allChunks.length };
};
