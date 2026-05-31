import path from "node:path";

/** Resolved locations of a workspace's `.soma/` runtime. */
export interface SomaPaths {
  workspace: string;
  root: string; // .soma
  agent: string; // .soma/agent
  memory: string; // .soma/memory
  facts: string; // .soma/facts
  factsFile: string; // .soma/facts/facts.jsonl
  runs: string; // .soma/runs
  events: string; // .soma/events
  rawEventsFile: string; // .soma/events/raw.jsonl
  normalizedEventsFile: string; // .soma/events/normalized.jsonl
  sessions: string; // .soma/sessions
  study: string; // .soma/study
}

export function somaPaths(workspace: string): SomaPaths {
  const root = path.join(workspace, ".soma");
  return {
    workspace,
    root,
    agent: path.join(root, "agent"),
    memory: path.join(root, "memory"),
    facts: path.join(root, "facts"),
    factsFile: path.join(root, "facts", "facts.jsonl"),
    runs: path.join(root, "runs"),
    events: path.join(root, "events"),
    rawEventsFile: path.join(root, "events", "raw.jsonl"),
    normalizedEventsFile: path.join(root, "events", "normalized.jsonl"),
    sessions: path.join(root, "sessions"),
    study: path.join(root, "study"),
  };
}

/** Always-on identity files loaded into every prompt pack, in order. */
export const AGENT_FILES = [
  "system.md",
  "personality.md",
  "bio.md",
  "tool-policy.md",
  "memory-policy.md",
] as const;
