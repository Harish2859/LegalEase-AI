import { retrieve } from '../src/services/retrieval/retriever';
import { graph } from '../src/agents/graph';
import fs from 'fs';
import path from 'path';

// Queries derived from the actual ingested NDA — all clauses exist in the document
const TEST_QUERIES = [
  { question: "What are the termination rights of each party?", ground_truth: "This Agreement shall terminate on the delivery of written notice of termination from either Party." },
  { question: "What are the confidentiality obligations of the receiving party?", ground_truth: "The Receiving Party shall protect the Confidential Information in the same manner as it would protect its own confidential information and use it exclusively for the Purpose." },
  { question: "What law governs this agreement?", ground_truth: "This Agreement shall be governed and construed in accordance with the laws of India." },
  { question: "What happens to confidential information upon termination?", ground_truth: "The Receiving Party shall return all Confidential Information to the Disclosing Party upon request or upon termination of the Agreement." },
  { question: "Who owns the intellectual property disclosed under this agreement?", ground_truth: "No transfer of intellectual property right either by way of assignment or license is granted or implied by the disclosure of Confidential Information to the Receiving Party." },
  { question: "Can confidential information be shared with employees?", ground_truth: "Confidential Information may be disclosed to employees on a need to know basis with written consent from the Disclosing Party." },
  { question: "What are the exceptions to confidentiality obligations?", ground_truth: "Confidentiality obligations do not apply to information that was in the public domain, already in possession of the Receiving Party, received from a third party without restrictions, independently developed, or required to be disclosed by law." },
  { question: "What is the purpose of this agreement?", ground_truth: "The Parties wish to collaborate and enter into discussions for the Purpose and wish to keep such discussions confidential." },
  { question: "What constitutes confidential information under this agreement?", ground_truth: "Confidential Information means all non-public information disclosed directly or indirectly through any means of communication by the Disclosing Party, including financial, business, proprietary or technical information." },
  { question: "How long do confidentiality obligations last after termination?", ground_truth: "The obligations of the Receiving Party shall remain in effect for a period of years from the date of termination." },
  { question: "Can confidential information be disclosed under legal compulsion?", ground_truth: "Confidential Information may be disclosed as required by applicable law provided the Receiving Party notifies the Disclosing Party prior to such disclosure so as to afford the opportunity to seek a protective order." },
  { question: "What warranties do the parties make about their authority?", ground_truth: "Each Party represents and warrants that it is authorised to execute this Agreement and is competent to discharge the obligations under this Agreement." },
  { question: "Is there a non-compete or non-solicitation clause?", ground_truth: "The Partner agrees not to enter into any written or oral agreement that conflicts with the provisions of this Agreement." },
  { question: "What is the relationship between the parties under this agreement?", ground_truth: "Nothing in this Agreement will be construed to create a partnership, joint venture, franchise, fiduciary, employment or agency relationship between the parties." },
  { question: "What happens if a provision of the agreement is found unenforceable?", ground_truth: "If any provision shall be held by a court to be illegal, invalid or unenforceable, the remaining provisions shall remain in full force and effect." },
  { question: "Can either party make public statements about this agreement?", ground_truth: "The Receiving Party agrees not to issue or release for publication any articles or publicity matter relating to this Agreement without prior written consent from the Disclosing Party." },
  { question: "Does the agreement supersede prior understandings?", ground_truth: "This Agreement contains the full and complete understanding of the parties and supersedes all prior representations and understandings, whether oral or written." },
  { question: "How can this agreement be amended?", ground_truth: "This Agreement may be amended only in writing by mutual agreement of the Parties." },
  { question: "What court has jurisdiction over disputes?", ground_truth: "The competent courts at India shall have the sole and exclusive jurisdiction over any dispute that arises in relation to this Agreement." },
  { question: "What are the obligations regarding third party agreements?", ground_truth: "The Partner represents that its performance of this Agreement does not breach any agreement it has entered into with any third party." },
];

async function generateTestResults() {
  // Use agent mode if DOCUMENT_ID env var is set, otherwise fall back to retrieval-only
  const documentId = process.env.DOCUMENT_ID;
  const useAgent = !!documentId;
  console.log(`🔍 Running ${useAgent ? 'agentic (Week 3)' : 'retrieval-only (Week 2)'} pipeline over 20 NDA queries...\n`);
  if (useAgent) console.log(`   Document ID: ${documentId}\n`);

  const results: any = {
    question: [],
    answer: [],
    contexts: [],
    ground_truth: [],
  };

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const { question, ground_truth } = TEST_QUERIES[i];
    console.log(`[${i + 1}/20] ${question}`);

    try {
      // Rate limit: Cohere trial = 10 calls/min, add delay between queries
      if (i > 0) await new Promise(r => setTimeout(r, 7000));

      let answer: string;
      let safeContexts: string[];

      if (useAgent) {
        // Week 3 mode: run full LangGraph agent — answer is a cited LLM response
        const state = await graph.invoke({
          query: question,
          retryCount: 0,
          retrievedChunks: [],
          redFlags: [],
        });
        answer = state.answer ?? 'No answer generated.';
        safeContexts = (state.retrievedChunks ?? []).length > 0
          ? state.retrievedChunks.map((c: any) => c.parentContent || c.content).filter(Boolean)
          : ['No relevant context found.'];
      } else {
        // Week 2 mode: retrieval only — answer proxied from top context
        const chunks = await retrieve(question);
        // Truncate each context to 1500 chars to stay within 6000 TPM limit on 8b-instant
        safeContexts = chunks.length > 0
          ? chunks
              .map((c: any) => (c.parentContent || c.content || '').substring(0, 1500))
              .filter((t: any) => t.trim().length > 0)
          : ['No relevant context found.'];
        if (safeContexts.length === 0) safeContexts = ['No relevant context found.'];
        answer = safeContexts[0];
      }

      results.question.push(question);
      results.answer.push(answer);
      results.contexts.push(safeContexts);
      results.ground_truth.push(ground_truth);

    } catch (err: any) {
      console.error(`  ⚠️  Failed: ${err.message}`);
      results.question.push(question);
      results.answer.push("Retrieval failed.");
      results.contexts.push(["No context available."]);
      results.ground_truth.push(ground_truth);
    }
  }

  const outputPath = path.join(__dirname, '../scripts/test_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ test_results.json written to ${outputPath}`);
}

generateTestResults().catch(console.error);
