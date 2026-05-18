import { Annotation } from "@langchain/langgraph";

export const LegalGraphState = Annotation.Root({
  query: Annotation<string>(),
  transformedQuery: Annotation<string>(),
  retrievedChunks: Annotation<any[]>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  answer: Annotation<string>(),
  sources: Annotation<any[]>(),
  hallucinationScore: Annotation<number>(),
  retryCount: Annotation<number>({
    reducer: (x, y) => x + y,
    default: () => 0,
  }),
  redFlags: Annotation<any[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
});
