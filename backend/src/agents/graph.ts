import { StateGraph, START, END } from "@langchain/langgraph";
import { LegalGraphState } from "./state";
import { queryAnalyzer } from "./nodes/analyzer";
import { retrieverNode } from "./nodes/retriever";
import { gradeContext } from "./nodes/grader";
import { queryRewriter } from "./nodes/rewriter";
import { answerGenerator } from "./nodes/generator";

export const graph = new StateGraph(LegalGraphState)
  .addNode("analyze", queryAnalyzer)
  .addNode("retrieve", retrieverNode)
  .addNode("rewrite", queryRewriter)
  .addNode("generate", answerGenerator)

  .addEdge(START, "analyze")
  .addEdge("analyze", "retrieve")
  .addEdge("rewrite", "retrieve")
  .addEdge("generate", END)

  .addConditionalEdges("retrieve", gradeContext, {
    generate: "generate",
    rewrite: "rewrite",
  })

  .compile();
