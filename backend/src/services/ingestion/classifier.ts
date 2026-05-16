import Groq from "groq-sdk";

export const classifyClause = async (text: string): Promise<string> => {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "Classify this legal text into one category: Termination, Liability, IP, Payment, Confidentiality, Governing Law, or Other. Output ONLY the category name.",
      },
      { role: "user", content: text.substring(0, 500) },
    ],
    model: "llama-3.3-70b-versatile",
  });
  return completion.choices[0]?.message?.content || "Other";
};
