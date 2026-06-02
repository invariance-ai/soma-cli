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
  // Primary terminal ask surface: the backend's `/v1/ask` memory query. It
  // returns a cited answer and works with or without an LLM key. Skipped in
  // --dry-run (which exercises the local memory-prompt path). Any backend
  // unavailability falls through to the local person/memory paths below.
  if (!opts.dryRun) {
    try {
      const client = platformClientFromEnv({ workspaceId: opts.workspaceId, baseUrl: opts.backend });
      const result = await client.ask(question);
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        const clause = result.answer.answer_clauses[0];
        console.log(clause?.text ?? "(no grounded answer)");
        const cited = clause?.citations?.[0];
        const citedIds = [
          ...(cited?.receiptIds ?? []),
          ...(cited?.chunkIds ?? []),
          ...(cited?.entityIds ?? []),
        ];
        if (citedIds.length) {
          console.log("\nCitations:");
          for (const id of citedIds.slice(0, 12)) console.log(`  - ${id}`);
        }
        console.log(`\n[ask ${result.run_id} · backend]`);
      }
      return;
    } catch (err) {
      if (err instanceof PlatformError) {
        console.error(`note: backend ask unavailable (${err.message}) — falling back to memory.\n`);
      } else {
        throw err;
      }
    }
  }

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
