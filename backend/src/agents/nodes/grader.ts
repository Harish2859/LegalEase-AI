import Groq from "groq-sdk";
import { LegalGraphState } from "../state";

export const gradeContext = async (state: typeof LegalGraphState.State): Promise<"generate" | "rewrite"> => {
  console.log("--- GRADING CONTEXT RELEVANCE ---");

  if (state.retrievedChunks.length === 0) {
    return state.retryCount < 2 ? "rewrite" : "generate";
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const context = state.retrievedChunks.map((c: any) => c.content).join("\n");

  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: `User Query: ${state.query}
Retrieved Context: ${context.substring(0, 2000)}

Evaluate if the context contains enough specific information to answer the query accurately.
Output JSON: { "isRelevant": true/false, "reason": "..." }`,
      },
    ],
  });

  const grade = JSON.parse(response.choices[0].message.content!);

  if (!grade.isRelevant && state.retryCount < 2) {
    return "rewrite";
  }

  return "generate";
};
