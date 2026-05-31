import type { CompiledPromptPack, ModelProvider, ModelResult } from "../types.js";
import { citationsFromPack } from "./citations.js";

/**
 * Deterministic provider used for dry runs and tests. It never calls a model;
 * it summarizes what would be loaded so the loop is fully exercisable offline.
 */
export const dryRunProvider: ModelProvider = {
  name: "dry-run",
  async complete(input: CompiledPromptPack): Promise<ModelResult> {
    const { pack } = input;
    const cited = citationsFromPack(pack);
    const memList =
      pack.retrievedMemory.map((b) => b.relPath).join(", ") || "no matched memory";
    const text =
      `[dry-run] Task classified as "${pack.classification.kind}". ` +
      `Would answer "${pack.task.input}" using ${memList}. ` +
      `${input.totalTokens} est. tokens, ${pack.tools.length} tools in scope.`;
    return { text, provider: "dry-run", citations: cited };
  },
};
