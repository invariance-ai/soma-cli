/**
 * Core type contract for the Soma agent runtime.
 *
 * These types are the API surface other modules (memory, runs, providers,
 * CLI) build against. Keep this file logic-free.
 */

// ---------------------------------------------------------------------------
// Tasks & classification
// ---------------------------------------------------------------------------

/** The kinds of work a single Soma run can be. */
export type TaskKind =
  | "ask"
  | "remember"
  | "search"
  | "edit_memory"
  | "inspect_run"
  | "tool_action";

/** The raw request entering the runtime, identical shape across CLI/MCP/web. */
export interface UserTask {
  /** Free-text input from the user. */
  input: string;
  /** Optional explicit kind; when omitted the classifier infers it. */
  kind?: TaskKind;
  /** Where the task came from. */
  surface: "cli" | "mcp" | "web";
  /** Absolute path to the workspace whose `.soma/` is in play. */
  workspace: string;
  /** When true, never call a real model or mutate disk beyond run trace. */
  dryRun?: boolean;
}

export interface Classification {
  kind: TaskKind;
  /** 0..1 confidence in the chosen kind. */
  confidence: number;
  /** Short human-readable reason for the choice. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

/** Write lanes governing whether/how the agent may change a memory file. */
export type WritePolicy =
  | "human_locked" // agent reads only
  | "human_approved" // agent proposes, human applies
  | "agent_editable" // agent writes directly
  | "append_only" // agent appends dated entries
  | "generated"; // runtime overwrites from structured sources

/** Frontmatter contract for a `.soma/memory/**.md` file. */
export interface MemoryMeta {
  soma_id: string;
  type: string;
  owner: "agent" | "human" | string;
  write_policy: WritePolicy;
  confidence?: "low" | "medium" | "high";
  updated_at?: string;
  sources?: MemorySource[];
}

export interface MemorySource {
  type: "user_statement" | "cited_source" | "generated" | string;
  ref?: string;
}

/** A parsed memory file. */
export interface MemoryFile {
  /** Stable id derived from path, e.g. `memory:projects/soma`. */
  id: string;
  /** Path relative to `.soma/memory`, e.g. `projects/soma.md`. */
  relPath: string;
  /** Absolute path on disk. */
  absPath: string;
  meta: MemoryMeta;
  /** Markdown body without frontmatter. */
  body: string;
  /** First H1 title if present, else derived from filename. */
  title: string;
  /** All `##`/`###` headings, in order. */
  headings: string[];
}

/** A scored search hit, citation-ready. */
export interface MemoryHit {
  file: MemoryFile;
  score: number;
  /** Heading of the most relevant section, if any. */
  matchedHeading?: string;
  /** Short snippet around the strongest match. */
  snippet: string;
}

/** A compiled block of memory placed into a prompt pack. */
export interface MemoryBlock {
  id: string;
  /** `always` blocks are agent/* identity files; `retrieved` are search hits. */
  source: "always" | "retrieved";
  relPath: string;
  title: string;
  content: string;
  /** Estimated token cost (rough char/4 heuristic). */
  tokens: number;
}

/** A citation pointing back at a memory file or fact. */
export interface Citation {
  /** e.g. `memory:projects/soma` or `fact:fact_01J...`. */
  ref: string;
  relPath?: string;
  heading?: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export type SideEffectLevel = "none" | "read" | "write" | "external";

export interface ToolSpec {
  name: string;
  description: string;
  sideEffect: SideEffectLevel;
  /** Policy gate, e.g. which write lanes it may touch. */
  requiredPolicy?: WritePolicy[];
  /** Whether results from this tool should be cited in the answer. */
  cites: boolean;
}

export interface ToolCallLog {
  name: string;
  argsSummary: string;
  resultSummary: string;
  durationMs: number;
  /** Whether the result fed into the final answer. */
  used: boolean;
}

// ---------------------------------------------------------------------------
// Prompt pack
// ---------------------------------------------------------------------------

export interface ContextBudget {
  /** Soft cap on total tokens for memory blocks. */
  maxTokens: number;
}

export interface RuntimePolicies {
  /** Files the agent may write directly without proposal. */
  directWriteLanes: WritePolicy[];
}

export interface PromptProfile {
  id: string;
  /** Task kinds this profile serves. */
  kinds: TaskKind[];
  description: string;
}

export interface PromptPack {
  profile: PromptProfile;
  /** Always-on identity/system blocks from `.soma/agent`. */
  system: MemoryBlock[];
  alwaysMemory: MemoryBlock[];
  retrievedMemory: MemoryBlock[];
  tools: ToolSpec[];
  task: UserTask;
  classification: Classification;
  budget: ContextBudget;
  policies: RuntimePolicies;
  /** Memory blocks dropped to stay under budget. */
  trimmed: MemoryBlock[];
}

/** A prompt pack flattened into provider-ready text. */
export interface CompiledPromptPack {
  pack: PromptPack;
  systemPrompt: string;
  userPrompt: string;
  /** Ids of every memory block actually included. */
  loadedBlockIds: string[];
  totalTokens: number;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export interface ModelResult {
  text: string;
  provider: string;
  /** Citations the runtime resolved for the answer. */
  citations: Citation[];
  /** Raw model metadata, provider-specific. */
  meta?: Record<string, unknown>;
}

export interface ModelProvider {
  name: string;
  complete(input: CompiledPromptPack): Promise<ModelResult>;
}

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

export type FactConfidence = "low" | "medium" | "high";

export interface Fact {
  id: string;
  type: string; // e.g. "ownership"
  subject: string; // e.g. "service:payments"
  predicate: string; // e.g. "owned_by"
  object: string; // e.g. "team:infra"
  confidence: FactConfidence;
  source: {
    type: string;
    run_id?: string;
  };
  valid_from: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Runs & reporting
// ---------------------------------------------------------------------------

export interface MemoryWriteRecord {
  relPath: string;
  action: "applied" | "proposed" | "appended";
  /** Brief description of the change. */
  summary: string;
}

export interface LoadedBlockReport {
  id: string;
  relPath: string;
  source: "always" | "retrieved";
  used: boolean;
}

export interface RunTrace {
  id: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO
  task: UserTask;
  classification: Classification;
  profileId: string;
  loadedBlocks: LoadedBlockReport[];
  toolCalls: ToolCallLog[];
  memoryWrites: MemoryWriteRecord[];
  answer?: string;
  citations: Citation[];
  provider: string;
  /** Human-readable notes about context efficiency. */
  notes: string[];
}
