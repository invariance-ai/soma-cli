import { run } from "../../agent-core/index.js";
import { nowIso, today } from "../clock.js";
import type { UserTask } from "../../agent-core/index.js";

export async function cmdRemember(
  workspace: string,
  statement: string,
  opts: { authorize?: boolean },
): Promise<void> {
  const task: UserTask = {
    input: statement,
    kind: "remember",
    surface: "cli",
    workspace,
  };
  const { trace } = await run({
    task,
    now: nowIso(),
    date: today(),
    explicitlyAuthorized: opts.authorize,
  });

  for (const w of trace.memoryWrites) {
    console.log(`${w.action}: ${w.relPath} — ${w.summary}`);
  }
  if (trace.memoryWrites.length === 0) console.log("Nothing recorded.");
  console.log(`\n[run ${trace.id}]`);
}
