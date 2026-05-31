import type { TaskKind, ToolSpec } from "../types.js";

export const TOOLS: Record<string, ToolSpec> = {
  "memory.search": {
    name: "memory.search",
    description: "Ranked search over .soma/memory files.",
    sideEffect: "read",
    cites: true,
  },
  "memory.read": {
    name: "memory.read",
    description: "Read a memory file by relative path.",
    sideEffect: "read",
    cites: true,
  },
  "memory.apply_edit": {
    name: "memory.apply_edit",
    description: "Write a memory file directly (agent_editable/append_only).",
    sideEffect: "write",
    requiredPolicy: ["agent_editable", "append_only", "generated"],
    cites: false,
  },
  "memory.propose_edit": {
    name: "memory.propose_edit",
    description: "Propose an edit to a protected memory file (human_approved).",
    sideEffect: "write",
    requiredPolicy: ["human_approved"],
    cites: false,
  },
  "facts.append": {
    name: "facts.append",
    description: "Append a typed fact to facts.jsonl.",
    sideEffect: "write",
    cites: true,
  },
  "runs.inspect": {
    name: "runs.inspect",
    description: "Read a previous run trace and context report.",
    sideEffect: "read",
    cites: false,
  },
  "sessions.list": {
    name: "sessions.list",
    description: "List normalized work sessions by recency, importance, person, or source.",
    sideEffect: "read",
    cites: true,
  },
  "sessions.get": {
    name: "sessions.get",
    description: "Read a normalized session and its evidence event ids.",
    sideEffect: "read",
    cites: true,
  },
  "sessions.study": {
    name: "sessions.study",
    description: "Study a session and propose current-state updates or claims with evidence.",
    sideEffect: "write",
    cites: true,
  },
  "repo.search_files": {
    name: "repo.search_files",
    description: "Search workspace files by name/content.",
    sideEffect: "read",
    cites: true,
  },
  "repo.read_file": {
    name: "repo.read_file",
    description: "Read a workspace file.",
    sideEffect: "read",
    cites: true,
  },
};

/** Tools exposed per task kind — scoped, not global. */
const SCOPES: Record<TaskKind, string[]> = {
  ask: ["memory.search", "memory.read", "sessions.list", "sessions.get"],
  search: ["memory.search", "memory.read", "sessions.list", "sessions.get", "repo.search_files", "repo.read_file"],
  remember: ["memory.read", "memory.apply_edit", "memory.propose_edit", "facts.append"],
  edit_memory: ["memory.read", "memory.apply_edit", "memory.propose_edit"],
  inspect_run: ["runs.inspect"],
  tool_action: ["memory.search", "memory.read", "sessions.list", "sessions.get", "sessions.study", "repo.search_files", "repo.read_file"],
};

export function toolsForKind(kind: TaskKind): ToolSpec[] {
  return (SCOPES[kind] ?? []).map((n) => TOOLS[n]).filter(Boolean);
}
