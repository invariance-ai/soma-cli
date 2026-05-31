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
  "platform.findings": {
    name: "platform.findings",
    description: "List assembled findings (error clusters) from the platform backend.",
    sideEffect: "read",
    cites: true,
  },
  "platform.tickets": {
    name: "platform.tickets",
    description: "List tickets across sources (Linear/GitHub) from the platform backend.",
    sideEffect: "read",
    cites: true,
  },
  "platform.connectors": {
    name: "platform.connectors",
    description: "Read connector ingestion status from the platform backend.",
    sideEffect: "read",
    cites: false,
  },
  "platform.receipts": {
    name: "platform.receipts",
    description: "Query raw normalized receipts (events) from the platform backend.",
    sideEffect: "read",
    cites: true,
  },
  "platform.code_graph": {
    name: "platform.code_graph",
    description: "Read the code graph (nodes + edges) from the platform backend.",
    sideEffect: "read",
    cites: true,
  },
  "platform.people": {
    name: "platform.people",
    description: "List people with recent activity, reconstructed from receipts.",
    sideEffect: "read",
    cites: true,
  },
  "platform.people_activity": {
    name: "platform.people_activity",
    description: "What a specific person is doing — recent PRs, commits, tickets, messages.",
    sideEffect: "read",
    cites: true,
  },
};

const PLATFORM_READ = [
  "platform.findings",
  "platform.tickets",
  "platform.connectors",
  "platform.receipts",
  "platform.code_graph",
  "platform.people",
  "platform.people_activity",
];

/** Tools exposed per task kind — scoped, not global. */
const SCOPES: Record<TaskKind, string[]> = {
  ask: ["memory.search", "memory.read", "sessions.list", "sessions.get", ...PLATFORM_READ],
  search: ["memory.search", "memory.read", "sessions.list", "sessions.get", "repo.search_files", "repo.read_file", ...PLATFORM_READ],
  remember: ["memory.read", "memory.apply_edit", "memory.propose_edit", "facts.append"],
  edit_memory: ["memory.read", "memory.apply_edit", "memory.propose_edit"],
  inspect_run: ["runs.inspect"],
  tool_action: ["memory.search", "memory.read", "sessions.list", "sessions.get", "sessions.study", "repo.search_files", "repo.read_file", ...PLATFORM_READ],
};

export function toolsForKind(kind: TaskKind): ToolSpec[] {
  return (SCOPES[kind] ?? []).map((n) => TOOLS[n]).filter(Boolean);
}
