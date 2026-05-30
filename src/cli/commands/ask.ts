import {
  compilePromptPack,
  renderDryRun,
  run,
  claudeCliProvider,
  claudeCliAvailable,
  dryRunProvider,
} from "../../agent-core/index.js";
import { nowIso, today } from "../clock.js";
import type { UserTask } from "../../agent-core/index.js";

export async function cmdAsk(
  workspace: string,
  question: string,
  opts: { dryRun?: boolean; model?: string },
): Promise<void> {
  const task: UserTask = {
    input: question,
    kind: "ask",
    surface: "cli",
    workspace,
    dryRun: opts.dryRun,
  };

  if (opts.dryRun) {
    const pack = compilePromptPack(task);
    console.log(renderDryRun(pack));
    // still record the run so `runs inspect` works in dry-run
    await run({ task, now: nowIso(), date: today(), provider: dryRunProvider });
    return;
  }

  // Real model: prefer claude CLI; fall back to dry-run with a notice.
  let provider = dryRunProvider;
  if (await claudeCliAvailable()) {
    provider = claudeCliProvider({ model: opts.model });
  } else {
    console.error("note: `claude` CLI not found on PATH — falling back to dry-run.\n");
  }

  const { trace, answer } = await run({ task, now: nowIso(), date: today(), provider });
  console.log(answer ?? "(no answer)");
  if (trace.citations.length) {
    console.log("\nCitations:");
    for (const c of trace.citations) console.log(`  - ${c.label} (${c.relPath ?? c.ref})`);
  }
  console.log(`\n[run ${trace.id} · provider ${trace.provider}]`);
}
