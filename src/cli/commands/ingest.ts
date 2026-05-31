import fs from "node:fs";
import { ingestPayload } from "../../agent-core/index.js";
import { nowIso } from "../clock.js";
import type { SourceName } from "../../agent-core/index.js";

const SOURCES = new Set(["slack", "granola", "email", "linear", "github", "datadog", "agent"]);

export function cmdIngest(
  workspace: string,
  file: string,
  opts: { source?: string; receivedAt?: string },
): void {
  if (!opts.source || !SOURCES.has(opts.source)) {
    throw new Error(`--source is required (${[...SOURCES].join(", ")})`);
  }
  const payload = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  const result = ingestPayload(workspace, opts.source as SourceName, payload, opts.receivedAt ?? nowIso());
  const studyCount = result.decisions.filter((d) => d.bucket === "study" || d.bucket === "surface").length;
  console.log(`raw:        ${result.rawEventId}`);
  console.log(`normalized: ${result.normalized.length} (${result.fresh.length} new)`);
  console.log(`sessions:   ${result.sessions.length}`);
  console.log(`studyable:  ${studyCount}`);
}
