import { retrieve } from '../src/services/retrieval/retriever';
import fs from 'fs';
import path from 'path';

// 20 representative CUAD-style queries covering key legal clause categories
const TEST_QUERIES = [
  { question: "What are the termination rights of each party?", ground_truth: "Either party may terminate this agreement with written notice upon material breach." },
  { question: "Is there a non-compete clause?", ground_truth: "The party agrees not to engage in competitive activities for a defined period after termination." },
  { question: "What is the liability cap?", ground_truth: "Aggregate liability shall not exceed the total fees paid in the twelve months preceding the claim." },
  { question: "What are the payment terms?", ground_truth: "Invoices are due within thirty days of receipt and late payments accrue interest." },
  { question: "Who owns the intellectual property created under this agreement?", ground_truth: "All work product created by the contractor is assigned to the client upon full payment." },
  { question: "What law governs this contract?", ground_truth: "This agreement shall be governed by the laws of the State of Delaware." },
  { question: "What are the confidentiality obligations?", ground_truth: "Each party shall keep confidential all non-public information disclosed by the other party." },
  { question: "Can the contract be assigned to a third party?", ground_truth: "Neither party may assign this agreement without prior written consent of the other party." },
  { question: "What triggers an automatic renewal?", ground_truth: "The agreement renews automatically for successive one-year terms unless notice is given 30 days prior." },
  { question: "What are the indemnification obligations?", ground_truth: "Each party shall indemnify the other against third-party claims arising from its own negligence." },
  { question: "What constitutes a material breach?", ground_truth: "Failure to pay, breach of confidentiality, or violation of IP terms constitutes a material breach." },
  { question: "What is the notice period for termination?", ground_truth: "A party must provide thirty days written notice to terminate this agreement without cause." },
  { question: "Are there any audit rights?", ground_truth: "The client has the right to audit the contractor's records upon reasonable written notice." },
  { question: "What are the dispute resolution procedures?", ground_truth: "Disputes shall first be subject to mediation before proceeding to binding arbitration." },
  { question: "What warranties are provided?", ground_truth: "The service provider warrants that services will be performed in a professional and workmanlike manner." },
  { question: "What are the data protection obligations?", ground_truth: "Each party shall comply with applicable data protection laws and implement reasonable security measures." },
  { question: "Is there a force majeure clause?", ground_truth: "Neither party is liable for delays caused by circumstances beyond their reasonable control." },
  { question: "What are the limitations on consequential damages?", ground_truth: "Neither party shall be liable for indirect, incidental, or consequential damages under any circumstances." },
  { question: "What are the minimum purchase commitments?", ground_truth: "The buyer commits to a minimum annual purchase volume as specified in the attached schedule." },
  { question: "What are the conditions for price changes?", ground_truth: "Prices may be adjusted annually with sixty days written notice to the other party." },
];

async function generateTestResults() {
  console.log("🔍 Running retrieval pipeline over 20 CUAD-style queries...\n");

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
      const chunks = await retrieve(question);

      // contexts = parent sections (full legal context sent to LLM)
      const contexts = chunks.length > 0
        ? chunks.map((c: any) => c.parentContent || c.content)
        : ["No relevant context found."];

      // answer = concatenated top context (simulates LLM answer for evaluation)
      const answer = contexts[0];

      results.question.push(question);
      results.answer.push(answer);
      results.contexts.push(contexts);
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
