import Groq from "groq-sdk";
import { LegalGraphState } from "../state";

export const answerGenerator = async (state: typeof LegalGraphState.State) => {
  console.log("--- GENERATING CITED ANSWER ---");

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const context = state.retrievedChunks
    .map((c: any) => {
      const page = c.pageStart != null ? `Page ${c.pageStart}` : 'page unknown';
      return `[Section: ${c.sectionTitle ?? 'Unknown'}, ${page}]\n${c.parentContent || c.content}`;
    })
    .join("\n\n---\n\n");

  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "user",
        content: `ROLE: You are a professional Legal Document Analyst.
TASK: Answer the user's question using ONLY the provided context.

CONTEXT:
${context}

USER QUESTION: ${state.query}

STRICT RULES:
1. If the answer isn't in the context, say you don't know.
2. Every claim MUST be followed by a citation in brackets, e.g., [Source: Section Name, Page X].
3. Use a professional, objective tone.`,
      },
    ],
  });

  return { answer: response.choices[0].message.content! };
};
