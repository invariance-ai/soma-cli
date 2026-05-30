import { latestRun } from "../../agent-core/index.js";

export function cmdRunsInspect(workspace: string, which: string): void {
  if (which !== "latest") {
    console.error(`Only "latest" is supported currently (got "${which}").`);
    process.exitCode = 1;
    return;
  }
  const loaded = latestRun(workspace);
  if (!loaded) {
    console.log("No runs recorded yet.");
    return;
  }
  const { trace, contextReport } = loaded;
  console.log(`Run ${trace.id}  (${trace.date} · ${trace.createdAt})`);
  console.log(`Task:   ${trace.task.input}`);
  console.log(`Kind:   ${trace.classification.kind} (${trace.classification.reason})`);
  console.log(`Profile/provider: ${trace.profileId} / ${trace.provider}`);
  if (trace.answer) {
    console.log(`\nAnswer:\n${trace.answer}`);
  }
  console.log("");
  console.log(contextReport.trim());
}
