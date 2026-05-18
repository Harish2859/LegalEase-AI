import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RISK_MAP: Record<string, { severity: string; recommendation: string }> = {
  Termination:     { severity: 'critical', recommendation: 'Review termination triggers and required notice periods.' },
  Liability:       { severity: 'critical', recommendation: 'Negotiate liability caps and mutual indemnification clauses.' },
  IP:              { severity: 'high',     recommendation: 'Clarify IP ownership, assignment scope, and work-for-hire terms.' },
  Confidentiality: { severity: 'high',     recommendation: 'Verify scope, duration, and permitted disclosure exceptions.' },
  Payment:         { severity: 'medium',   recommendation: 'Confirm payment schedules, late penalties, and dispute resolution.' },
};

export default async function redFlagsRoute(app: FastifyInstance) {
  app.get('/documents/:id/red-flags', async (request, reply) => {
    const { id } = request.params as { id: string };
    const flags = await prisma.redFlag.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send(flags);
  });

  app.post('/documents/:id/red-flags/scan', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Clear stale results before re-scan
    await prisma.redFlag.deleteMany({ where: { documentId: id } });

    // Derive flags from Week 1 classifier output stored on child chunks
    const riskyChunks = await prisma.chunk.findMany({
      where: { documentId: id, chunkType: 'child', clauseType: { in: Object.keys(RISK_MAP) } },
      select: { id: true, clauseType: true, sectionTitle: true, pageStart: true, content: true },
    });

    if (riskyChunks.length) {
      await prisma.redFlag.createMany({
        data: riskyChunks.map((c) => {
          const risk = RISK_MAP[c.clauseType!];
          return {
            documentId:     id,
            flagType:       c.clauseType!,
            severity:       risk.severity,
            explanation:    c.content.substring(0, 220).trimEnd() + (c.content.length > 220 ? '…' : ''),
            recommendation: risk.recommendation,
            sectionTitle:   c.sectionTitle ?? null,
            pageStart:      c.pageStart    ?? null,
          };
        }),
      });
    }

    const flags = await prisma.redFlag.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send(flags);
  });

  // Right-to-Erasure: delete document + all chunks + flags (Cascade handles DB rows)
  app.delete('/documents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.document.delete({ where: { id } });
    return reply.send({ deleted: id });
  });
}
