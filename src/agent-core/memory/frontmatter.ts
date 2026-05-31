import matter from "gray-matter";
import type { MemoryMeta, WritePolicy } from "../types.js";

const WRITE_POLICIES: WritePolicy[] = [
  "human_locked",
  "human_approved",
  "agent_editable",
  "append_only",
  "generated",
];

export interface ParsedMemory {
  meta: MemoryMeta;
  body: string;
}

/**
 * Parse a memory markdown string into typed frontmatter + body. Missing or
 * invalid frontmatter falls back to safe defaults (human_approved) so a
 * hand-written file is never silently treated as agent-writable.
 */
export function parseMemory(raw: string, relPath: string): ParsedMemory {
  const parsed = matter(raw);
  const data = parsed.data ?? {};

  const writePolicy = WRITE_POLICIES.includes(data.write_policy)
    ? (data.write_policy as WritePolicy)
    : "human_approved";

  const meta: MemoryMeta = {
    soma_id: typeof data.soma_id === "string" ? data.soma_id : `memory:${relPath.replace(/\.md$/, "")}`,
    type: typeof data.type === "string" ? data.type : "memory",
    owner: typeof data.owner === "string" ? data.owner : "human",
    write_policy: writePolicy,
    confidence: data.confidence,
    updated_at: data.updated_at,
    sources: Array.isArray(data.sources) ? data.sources : undefined,
  };

  return { meta, body: parsed.content.trim() };
}

/** Serialize meta + body back into a frontmatter markdown string. */
export function stringifyMemory(meta: MemoryMeta, body: string): string {
  const data: Record<string, unknown> = {
    soma_id: meta.soma_id,
    type: meta.type,
    owner: meta.owner,
    write_policy: meta.write_policy,
  };
  if (meta.confidence) data.confidence = meta.confidence;
  if (meta.updated_at) data.updated_at = meta.updated_at;
  if (meta.sources) data.sources = meta.sources;
  // gray-matter's stringify keeps key order from the object.
  return matter.stringify(`\n${body.trim()}\n`, data);
}
