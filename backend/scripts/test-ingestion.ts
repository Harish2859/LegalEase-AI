import { ingestDocument } from '../src/services/ingestion';
import fs from 'fs';
import path from 'path';

async function test() {
  const samplePath = path.join(__dirname, '../samples/sample_nda.pdf');
  const buffer = fs.readFileSync(samplePath);

  console.log("🚀 Starting Ingestion Test...");
  const result = await ingestDocument(samplePath, buffer, 'test-user-id');

  console.log("✅ Ingestion Complete!");
  const { document, chunkCount } = result as { document: { id: string }, chunkCount: number };
  console.log(`📄 Document ID: ${document.id}`);
  console.log(`🧩 Chunks Created: ${chunkCount}`);
}

test().catch(console.error);
