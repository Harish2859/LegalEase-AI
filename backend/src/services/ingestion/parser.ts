import { LlamaParse } from "llama-parse";
import fs from "fs";

export const parseLegalDocument = async (filePath: string) => {
  const reader = new LlamaParse({
    apiKey: process.env.LLAMA_CLOUD_API_KEY!,
  });

  const buffer = fs.readFileSync(filePath);
  const blob = new Blob([buffer], { type: "application/pdf" });

  const result = await reader.parseFile(blob);

  return [{ text: result.markdown, pageNumber: result.job_metadata.job_pages }];
};
