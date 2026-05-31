import {
  compilePromptPack,
  renderDryRun,
  run,
  claudeCliProvider,
  claudeCliAvailable,
  dryRunProvider,
  extractPersonQuery,
  answerPersonQuestion,
  platformClientFromEnv,
  PlatformError,
} from "../../agent-core/index.js";
import { nowIso, today } from "../clock.js";
import type { UserTask } from "../../agent-core/index.js";

export async function cmdAsk(
  workspace: string,
  question: string,
  opts: { dryRun?: boolean; model?: string; json?: boolean; workspaceId?: string; backend?: string },
): Promise<void> {
  // People questions ("what is andy doing?") route through the platform: fetch
  // the person's deterministic activity, then let the model summarize it. This
  // is skipped in --dry-run (which exercises the memory-prompt path).
  if (!opts.dryRun) {
    const person = extractPersonQuery(question);
    if (person) {
      try {
        const client = platformClientFromEnv({ workspaceId: opts.workspaceId, baseUrl: opts.backend });
        const result = await answerPersonQuestion(client, question, person, { model: opts.model });
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result.answer);
          console.log(`\n[person ${result.person} · source ${result.source}]`);
        }
        return;
      } catch (err) {
        if (err instanceof PlatformError) {
          console.error(`note: platform unavailable (${err.message}) — falling back to memory.\n`);
        } else {
          throw err;
        }
      }
    }
  }

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
