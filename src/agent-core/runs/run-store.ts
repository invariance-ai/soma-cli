import fs from "node:fs";
import path from "node:path";
import { somaPaths } from "../paths.js";
import type { CompiledPromptPack, RunTrace } from "../types.js";
import { renderContextReport } from "./context-report.js";

function runDir(workspace: string, date: string): string {
  return path.join(somaPaths(workspace).runs, date);
}

/** Peek the id the next writeRun on this date will assign (e.g. run_002). */
export function peekNextRunId(workspace: string, date: string): string {
  return nextRunId(workspace, date);
}

/** Next sequential run id for a date, e.g. run_001. */
function nextRunId(workspace: string, date: string): string {
  const dir = runDir(workspace, date);
  let max = 0;
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      const m = name.match(/^run_(\d+)\.json$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `run_${String(max + 1).padStart(3, "0")}`;
}

export interface WriteRunInput {
  trace: Omit<RunTrace, "id">;
  compiled?: CompiledPromptPack;
  /** Optional memory diff markdown. */
  memoryDiff?: string;
}

/** Persist a run: JSON trace, prompt snapshot, context report, memory diff. */
export function writeRun(workspace: string, input: WriteRunInput): RunTrace {
  const { trace } = input;
  const dir = runDir(workspace, trace.date);
  fs.mkdirSync(dir, { recursive: true });
  const id = nextRunId(workspace, trace.date);
  const full: RunTrace = { ...trace, id };

  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(full, null, 2), "utf8");

  if (input.compiled) {
    const snapshot = [
      "# System Prompt",
      "",
      input.compiled.systemPrompt,
      "",
      "# User Prompt",
      "",
      input.compiled.userPrompt,
    ].join("\n");
    fs.writeFileSync(path.join(dir, `${id}.prompt.md`), snapshot + "\n", "utf8");
  }

  fs.writeFileSync(path.join(dir, `${id}.context.md`), renderContextReport(full), "utf8");

  if (input.memoryDiff) {
    fs.writeFileSync(path.join(dir, `${id}.memory-diff.md`), input.memoryDiff, "utf8");
  }

  return full;
}

export interface LoadedRun {
  trace: RunTrace;
  dir: string;
  contextReport: string;
}

/** Find the most recent run by date then sequence. */
export function latestRun(workspace: string): LoadedRun | null {
  const { runs } = somaPaths(workspace);
  if (!fs.existsSync(runs)) return null;
  const dates = fs
    .readdirSync(runs)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  for (let i = dates.length - 1; i >= 0; i--) {
    const dir = path.join(runs, dates[i]);
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^run_\d+\.json$/.test(f))
      .sort();
    if (files.length === 0) continue;
    const file = files[files.length - 1];
    const trace = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as RunTrace;
    const ctxPath = path.join(dir, file.replace(/\.json$/, ".context.md"));
    const contextReport = fs.existsSync(ctxPath) ? fs.readFileSync(ctxPath, "utf8") : "";
    return { trace, dir, contextReport };
  }
  return null;
}
