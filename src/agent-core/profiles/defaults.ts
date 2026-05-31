import type { PromptProfile, RuntimePolicies, ContextBudget } from "../types.js";

export const PROFILES: PromptProfile[] = [
  {
    id: "answerer",
    kinds: ["ask", "search"],
    description: "Answer questions grounded in loaded memory, with citations.",
  },
  {
    id: "scribe",
    kinds: ["remember", "edit_memory"],
    description: "Record durable memory and facts, respecting write policies.",
  },
  {
    id: "inspector",
    kinds: ["inspect_run"],
    description: "Explain what happened during a previous run.",
  },
  {
    id: "operator",
    kinds: ["tool_action"],
    description: "Carry out a scoped tool action.",
  },
];

export function profileForKind(kind: string): PromptProfile {
  return PROFILES.find((p) => p.kinds.includes(kind as never)) ?? PROFILES[0];
}

export const DEFAULT_BUDGET: ContextBudget = { maxTokens: 6000 };

export const DEFAULT_POLICIES: RuntimePolicies = {
  directWriteLanes: ["agent_editable", "append_only", "generated"],
};
