import Groq from "groq-sdk";
import { LegalGraphState } from "../state";

export const queryRewriter = async (state: typeof LegalGraphState.State) => {
  console.log("--- REWRITING QUERY FOR BETTER RETRIEVAL ---");

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "user",
        content: `The previous search for "${state.transformedQuery}" failed to find relevant legal clauses.
Based on the original user intent: "${state.query}", generate a more specific legal search query.
Focus on synonyms, legal jargon, or related section titles.
Output ONLY the new query string.`,
      },
    ],
  });

  return {
    transformedQuery: response.choices[0].message.content!,
    retryCount: 1,
  };
};
