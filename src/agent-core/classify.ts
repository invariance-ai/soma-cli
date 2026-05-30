import type { Classification, TaskKind, UserTask } from "./types.js";

interface Rule {
  kind: TaskKind;
  test: RegExp;
  reason: string;
}

/**
 * Lightweight deterministic classifier. Explicit `task.kind` always wins;
 * otherwise the first matching rule does, falling back to "ask".
 */
const RULES: Rule[] = [
  { kind: "remember", test: /^\s*(remember|note that|record that|fyi|save this)\b/i, reason: "imperative memory verb" },
  { kind: "remember", test: /\b(is owned by|owns|belongs to|reports to|depends on)\b/i, reason: "structured relationship statement" },
  { kind: "inspect_run", test: /\b(inspect|show|explain)\b.*\brun\b/i, reason: "run inspection phrasing" },
  { kind: "search", test: /^\s*(search|find|grep|look up|where is)\b/i, reason: "search verb" },
  { kind: "edit_memory", test: /^\s*(edit|update|change|fix)\b.*\bmemory\b/i, reason: "memory edit verb" },
  { kind: "tool_action", test: /^\s*(run|execute|do)\b/i, reason: "action verb" },
];

export function classify(task: UserTask): Classification {
  if (task.kind) {
    return { kind: task.kind, confidence: 1, reason: "explicit task.kind" };
  }
  for (const rule of RULES) {
    if (rule.test.test(task.input)) {
      return { kind: rule.kind, confidence: 0.7, reason: rule.reason };
    }
  }
  return { kind: "ask", confidence: 0.5, reason: "default" };
}
