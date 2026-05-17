import Groq from "groq-sdk";

interface ExpandedQuery {
  hypothesis: string;
  keywords: string[];
}

export const expandQuery = async (userQuery: string): Promise<ExpandedQuery> => {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: `You are a legal research assistant. The user asked: "${userQuery}"
1. Generate a hypothetical, highly formal legal paragraph that would answer this.
2. List 3 specific legal keywords or phrases related to this query.
Output in JSON: { "hypothesis": "...", "keywords": ["...", "...", "..."] }`,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content!);
};
