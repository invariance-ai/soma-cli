import { nanoid } from "nanoid";
import fs from "node:fs";
import path from "node:path";
import { somaPaths } from "./paths.js";
import { readMemory, writeMemory, appendMemoryEntry } from "./memory/markdown-store.js";
import { decideWrite } from "./memory/policies.js";
import { appendFact } from "./facts/fact-store.js";
import { extractRelationship } from "./facts/fact-schema.js";
import type { Fact, MemoryWriteRecord } from "./types.js";

export interface RememberResult {
  writes: MemoryWriteRecord[];
  fact?: Fact;
  /** Proposal files written under the run dir, if any. */
  proposals: { relPath: string; absPath: string }[];
}

export interface RememberOptions {
  workspace: string;
  statement: string;
  now: string; // ISO
  runId: string;
  /** Run dir to drop proposals into. */
  runDir: string;
  /** User explicitly authorized writing protected files. */
  explicitlyAuthorized?: boolean;
}

/**
 * Route a remembered statement:
 * - structured relationship -> typed fact in facts.jsonl
 * - otherwise prose status   -> memory/active-work.md (agent_editable)
 * Protected target files get a proposal instead of a direct write.
 */
export function remember(opts: RememberOptions): RememberResult {
  const writes: MemoryWriteRecord[] = [];
  const proposals: RememberResult["proposals"] = [];

  const rel = extractRelationship(opts.statement);
  if (rel) {
    const fact: Fact = {
      id: `fact_${nanoid(12)}`,
      type: rel.type,
      subject: rel.subject,
      predicate: rel.predicate,
      object: rel.object,
      confidence: "high",
      source: { type: "user_statement", run_id: opts.runId },
      valid_from: opts.now,
      created_at: opts.now,
    };
    const saved = appendFact(opts.workspace, fact);
    writes.push({
      relPath: "facts/facts.jsonl",
      action: "appended",
      summary: `${saved.subject} ${saved.predicate} ${saved.object}`,
    });
    return { writes, fact: saved, proposals };
  }

  // Prose -> active-work.md
  const targetRel = "active-work.md";
  const file = readMemory(opts.workspace, targetRel);
  if (!file) throw new Error("active-work.md missing; run `soma init` first");

  const decision = decideWrite(file.meta.write_policy, {
    explicitlyAuthorized: opts.explicitlyAuthorized,
  });

  const entry = `- ${opts.statement.trim()}`;

  if (decision.action === "apply") {
    const newBody = `${file.body}\n${entry}`;
    writeMemory(opts.workspace, targetRel, { ...file.meta, updated_at: opts.now }, newBody);
    writes.push({ relPath: `memory/${targetRel}`, action: "applied", summary: opts.statement });
  } else if (decision.action === "append") {
    appendMemoryEntry(opts.workspace, targetRel, entry, opts.now);
    writes.push({ relPath: `memory/${targetRel}`, action: "appended", summary: opts.statement });
  } else {
    // propose or reject -> write a proposal file the human can review
    const proposalRel = `${opts.runId}.proposal-active-work.md`;
    const absPath = path.join(opts.runDir, proposalRel);
    fs.mkdirSync(opts.runDir, { recursive: true });
    fs.writeFileSync(
      absPath,
      `# Proposed edit to memory/${targetRel}\n\nReason: ${decision.reason}\n\nProposed addition:\n\n${entry}\n`,
      "utf8",
    );
    proposals.push({ relPath: proposalRel, absPath });
    writes.push({
      relPath: `memory/${targetRel}`,
      action: "proposed",
      summary: `${decision.reason}: ${opts.statement}`,
    });
  }

  return { writes, proposals };
}

/** Ensure the runs dir for a date exists and return it. */
export function ensureRunDir(workspace: string, date: string): string {
  const dir = path.join(somaPaths(workspace).runs, date);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
