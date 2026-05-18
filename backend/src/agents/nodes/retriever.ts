import { retrieve } from "../../services/retrieval/retriever";
import { LegalGraphState } from "../state";

export const retrieverNode = async (state: typeof LegalGraphState.State) => {
  console.log("--- EXECUTING RETRIEVAL ---");

  const results = await retrieve(state.transformedQuery);

  return {
    retrievedChunks: results,
    sources: results.map((c: any) => ({
      section: c.sectionTitle,
      page: c.pageStart,
      excerpt: c.content.substring(0, 200),
    })),
  };
};
