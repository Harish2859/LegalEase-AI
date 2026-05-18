import Groq from "groq-sdk";
import { LegalGraphState } from "../state";

export const queryAnalyzer = async (state: typeof LegalGraphState.State) => {
  console.log("--- ANALYZING QUERY ---");

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: `Analyze the user's legal query: "${state.query}"
Decide if this is a:
1. GENERAL_QA: Standard question about the contract.
2. RED_FLAG_SCAN: A request to find risks or specific dangerous clauses.
3. SUMMARY: A request for a document overview.

Also, extract any specific legal categories mentioned (e.g., Termination, IP, Liability).
Output JSON: { "intent": "...", "categories": [] }`,
      },
    ],
  });

  const analysis = JSON.parse(response.choices[0].message.content!);

  return { transformedQuery: state.query, ...analysis };
};
