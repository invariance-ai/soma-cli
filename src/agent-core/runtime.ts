import path from "node:path";
import { somaPaths } from "./paths.js";
import { compilePromptPack, renderPromptPack } from "./prompt-pack.js";
import { writeRun, peekNextRunId } from "./runs/run-store.js";
import { remember } from "./remember.js";
import { dryRunProvider } from "./providers/dry-run.js";
import type {
  LoadedBlockReport,
  ModelProvider,
  RunTrace,
  UserTask,
} from "./types.js";

export interface RunOptions {
  task: UserTask;
  /** ISO timestamp + YYYY-MM-DD date (injected so the core stays deterministic). */
  now: string;
  date: string;
  /** Provider for `ask`-style tasks; defaults to dry-run. */
  provider?: ModelProvider;
  /** User explicitly authorized protected memory writes. */
  explicitlyAuthorized?: boolean;
}

export interface RunOutput {
  trace: RunTrace;
  answer?: string;
}

/** Mark which loaded blocks the answer actually referenced. */
function reportBlocks(
  pack: ReturnType<typeof compilePromptPack>,
  citedRefs: Set<string>,
): LoadedBlockReport[] {
  const all = [...pack.system, ...pack.alwaysMemory, ...pack.retrievedMemory];
  return all.map((b) => ({
    id: b.id,
    relPath: b.relPath,
    source: b.source,
    // Always-on identity blocks count as used; retrieved blocks must be cited.
    used: b.source === "always" || citedRefs.has(b.relPath),
  }));
}

/**
 * The end-to-end run loop: classify -> compile pack -> run/remember ->
 * record trace + context report + memory writes.
 */
export async function run(opts: RunOptions): Promise<RunOutput> {
  const { task } = opts;
  const pack = compilePromptPack(task);
  const compiled = renderPromptPack(pack);
  const runDir = path.join(somaPaths(task.workspace).runs, opts.date);

  const base: Omit<RunTrace, "id"> = {
    date: opts.date,
    createdAt: opts.now,
    task,
    classification: pack.classification,
    profileId: pack.profile.id,
    loadedBlocks: [],
    toolCalls: [],
    memoryWrites: [],
    citations: [],
    provider: "",
    notes: [],
  };

  // --- remember / edit_memory path -----------------------------------------
  if (pack.classification.kind === "remember" || pack.classification.kind === "edit_memory") {
    // writeRun assigns the id; peek it so fact provenance + proposal names match.
    const runId = peekNextRunId(task.workspace, opts.date);
    const res = remember({
      workspace: task.workspace,
      statement: task.input,
      now: opts.now,
      runId,
      runDir,
      explicitlyAuthorized: opts.explicitlyAuthorized,
    });
    const notes: string[] = [];
    if (res.fact) notes.push(`Appended fact ${res.fact.id}: ${res.fact.subject} ${res.fact.predicate} ${res.fact.object}.`);
    for (const p of res.proposals) notes.push(`Proposal written: runs/${opts.date}/${p.relPath}`);

    const trace = writeRun(task.workspace, {
      trace: {
        ...base,
        loadedBlocks: reportBlocks(pack, new Set()),
        memoryWrites: res.writes,
        provider: "none",
        notes,
        answer: notes.join(" ") || "Recorded.",
      },
      compiled,
    });
    return { trace, answer: trace.answer };
  }

  // --- ask / search / inspect path -----------------------------------------
  const provider = task.dryRun ? dryRunProvider : opts.provider ?? dryRunProvider;
  const result = await provider.complete(compiled);
  const citedRefs = new Set(result.citations.map((c) => c.relPath).filter(Boolean) as string[]);

  const trace = writeRun(task.workspace, {
    trace: {
      ...base,
      loadedBlocks: reportBlocks(pack, citedRefs),
      citations: result.citations,
      provider: result.provider,
      answer: result.text,
      notes: pack.trimmed.length ? [`${pack.trimmed.length} block(s) trimmed for budget.`] : [],
    },
    compiled,
  });

  return { trace, answer: result.text };
}
