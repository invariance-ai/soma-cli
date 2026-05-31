import type { RunTrace } from "../types.js";

/** Render a run's context accounting as a readable markdown report. */
export function renderContextReport(trace: RunTrace): string {
  const lines: string[] = ["# Context Report", ""];

  lines.push("## Loaded");
  lines.push("");
  for (const b of trace.loadedBlocks) {
    lines.push(`- \`${b.relPath}\` (${b.source}) - ${b.used ? "used" : "unused"}`);
  }
  if (trace.loadedBlocks.length === 0) lines.push("- (none)");
  lines.push("");

  lines.push("## Tool Calls");
  lines.push("");
  for (const t of trace.toolCalls) {
    lines.push(`- \`${t.name}\` - ${t.used ? "useful" : "unused"} (${t.durationMs}ms)`);
  }
  if (trace.toolCalls.length === 0) lines.push("- (none)");
  lines.push("");

  lines.push("## Memory Writes");
  lines.push("");
  for (const w of trace.memoryWrites) {
    lines.push(`- \`${w.relPath}\` - ${w.action}: ${w.summary}`);
  }
  if (trace.memoryWrites.length === 0) lines.push("- (none)");
  lines.push("");

  lines.push("## Notes");
  lines.push("");
  const unused = trace.loadedBlocks.filter((b) => !b.used);
  if (unused.length) {
    lines.push(`Loaded but unused: ${unused.map((b) => `\`${b.relPath}\``).join(", ")}.`);
  }
  for (const n of trace.notes) lines.push(n);
  if (!unused.length && trace.notes.length === 0) lines.push("No wasted context detected.");

  return lines.join("\n") + "\n";
}
