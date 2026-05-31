// Public surface of the Soma agent core.

export * from "./types.js";
export { somaPaths, AGENT_FILES } from "./paths.js";
export type { SomaPaths } from "./paths.js";

export { initSoma } from "./init/initializer.js";
export type { InitResult } from "./init/initializer.js";

export { parseMemory, stringifyMemory } from "./memory/frontmatter.js";
export {
  readAllMemory,
  readMemory,
  writeMemory,
  appendMemoryEntry,
} from "./memory/markdown-store.js";
export { searchMemory } from "./memory/memory-store.js";
export { decideWrite } from "./memory/policies.js";
export type { WriteAction, WriteDecision } from "./memory/policies.js";

export { classify } from "./classify.js";
export {
  compilePromptPack,
  renderPromptPack,
  renderDryRun,
  estimateTokens,
} from "./prompt-pack.js";
export { toolsForKind, TOOLS } from "./tools/tool-registry.js";

export { appendFact, readFacts } from "./facts/fact-store.js";
export { FactSchema, extractRelationship } from "./facts/fact-schema.js";

export { writeRun, latestRun } from "./runs/run-store.js";
export type { LoadedRun, WriteRunInput } from "./runs/run-store.js";
export { renderContextReport } from "./runs/context-report.js";

export { dryRunProvider } from "./providers/dry-run.js";
export { claudeCliProvider, claudeCliAvailable } from "./providers/claude-cli.js";
export { citationsFromPack, resolveCitations } from "./providers/citations.js";

export { remember } from "./remember.js";
export type { RememberResult, RememberOptions } from "./remember.js";

export { run } from "./runtime.js";
export type { RunOptions, RunOutput } from "./runtime.js";

export { normalizePayload } from "./normalization/normalizers.js";
export { ingestPayload } from "./normalization/ingest.js";
export type { IngestResult } from "./normalization/ingest.js";
export { readNormalizedEvents } from "./normalization/event-store.js";
export { buildSessions, readSession, readSessions, writeSessions } from "./normalization/sessionize.js";
export { scoreEventImportance, scoreSessionImportance } from "./normalization/importance.js";
export { studySession } from "./normalization/study.js";
