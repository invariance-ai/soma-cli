import type { WritePolicy } from "../types.js";

export interface TemplateFile {
  /** Path relative to `.soma/`. */
  relPath: string;
  content: string;
}

function frontmatter(fields: Record<string, string | undefined>): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`);
  return ["---", ...lines, "---", ""].join("\n");
}

function memoryDoc(opts: {
  somaId: string;
  type: string;
  owner: string;
  writePolicy: WritePolicy;
  confidence?: string;
  updatedAt: string;
  body: string;
}): string {
  return (
    frontmatter({
      soma_id: opts.somaId,
      type: opts.type,
      owner: opts.owner,
      write_policy: opts.writePolicy,
      confidence: opts.confidence,
      updated_at: opts.updatedAt,
    }) +
    "\n" +
    opts.body.trim() +
    "\n"
  );
}

/**
 * Default `.soma/` contents created by `soma init`.
 * `now` is the ISO timestamp stamped into frontmatter.
 */
export function defaultTemplates(now: string): TemplateFile[] {
  const files: TemplateFile[] = [];

  // --- agent/ identity files -------------------------------------------------
  files.push({
    relPath: "agent/system.md",
    content: memoryDoc({
      somaId: "agent:system",
      type: "system_prompt",
      owner: "human",
      writePolicy: "human_locked",
      updatedAt: now,
      body: `# Soma System Prompt

You are Soma, a queryability system for engineering work. You answer questions
about a workspace by loading the right memory, citing your sources, and keeping
durable notes about what you learn.

Rules:
- Ground every answer in loaded memory or facts. Cite the files you used.
- If memory does not cover the question, say so plainly rather than guessing.
- Be concise. Prefer specifics and numbers over prose.
- Never edit human-locked or human-approved memory without an explicit request.`,
    }),
  });

  files.push({
    relPath: "agent/personality.md",
    content: memoryDoc({
      somaId: "agent:personality",
      type: "personality",
      owner: "human",
      writePolicy: "human_approved",
      updatedAt: now,
      body: `# Personality

Soma is direct, terse, and engineer-facing. It favors evidence over enthusiasm,
flags uncertainty explicitly, and never pads answers.`,
    }),
  });

  files.push({
    relPath: "agent/bio.md",
    content: memoryDoc({
      somaId: "agent:bio",
      type: "bio",
      owner: "human",
      writePolicy: "human_approved",
      updatedAt: now,
      body: `# Operator Bio

<!-- Describe the human(s) Soma works for: role, focus areas, preferences. -->

- Role: (unset)
- Focus: (unset)`,
    }),
  });

  files.push({
    relPath: "agent/tool-policy.md",
    content: memoryDoc({
      somaId: "agent:tool-policy",
      type: "tool_policy",
      owner: "human",
      writePolicy: "human_approved",
      updatedAt: now,
      body: `# Tool Policy

Tools are exposed by task, not globally.

- ask:        memory.search, memory.read
- search:     memory.search, memory.read, repo.search_files, repo.read_file
- remember:   memory.read, memory.apply_edit, memory.propose_edit, facts.append
- inspect_run: runs.inspect

Write tools must respect each memory file's write_policy.`,
    }),
  });

  files.push({
    relPath: "agent/memory-policy.md",
    content: memoryDoc({
      somaId: "agent:memory-policy",
      type: "memory_policy",
      owner: "human",
      writePolicy: "human_approved",
      updatedAt: now,
      body: `# Memory Policy

Write lanes:
- human_locked:   read only
- human_approved: propose, do not apply
- agent_editable: write directly
- append_only:    append dated entries
- generated:      runtime may overwrite from structured sources

Defaults:
- agent/system.md          human_locked
- agent/personality.md     human_approved
- agent/bio.md             human_approved
- memory/active-work.md    agent_editable
- memory/histories/*.md    append_only
- memory/decisions.md      human_approved (unless user explicitly asks to record a decision)`,
    }),
  });

  // --- memory/ files ---------------------------------------------------------
  files.push({
    relPath: "memory/company.md",
    content: memoryDoc({
      somaId: "memory:company",
      type: "company_memory",
      owner: "agent",
      writePolicy: "human_approved",
      confidence: "low",
      updatedAt: now,
      body: `# Company

## Stable Context

<!-- What the company/workspace is. -->`,
    }),
  });

  files.push({
    relPath: "memory/active-work.md",
    content: memoryDoc({
      somaId: "memory:active-work",
      type: "active_work",
      owner: "agent",
      writePolicy: "agent_editable",
      confidence: "medium",
      updatedAt: now,
      body: `# Active Work

## Current Focus

- (nothing recorded yet)`,
    }),
  });

  files.push({
    relPath: "memory/decisions.md",
    content: memoryDoc({
      somaId: "memory:decisions",
      type: "decisions",
      owner: "agent",
      writePolicy: "human_approved",
      confidence: "medium",
      updatedAt: now,
      body: `# Decisions

<!-- Append-style log of explicit decisions. Recorded only on request. -->`,
    }),
  });

  files.push({
    relPath: "memory/repo.md",
    content: memoryDoc({
      somaId: "memory:repo",
      type: "repo_memory",
      owner: "agent",
      writePolicy: "agent_editable",
      confidence: "low",
      updatedAt: now,
      body: `# Repository

## Layout

<!-- Key directories, services, entry points. -->`,
    }),
  });

  files.push({
    relPath: "memory/projects/soma.md",
    content: memoryDoc({
      somaId: "memory:projects/soma",
      type: "project_memory",
      owner: "agent",
      writePolicy: "agent_editable",
      confidence: "medium",
      updatedAt: now,
      body: `# Soma

## Stable Context

Soma is a queryability system for engineering work. The agentic core decides
what context to load, what tools to use, what answer to produce, and what
memory to keep.

## Active Work

- Build the agentic core and memory runtime first.

## Open Questions

- How strict should memory write approval be for identity files?`,
    }),
  });

  files.push({
    relPath: "memory/histories/agent-runs.md",
    content: memoryDoc({
      somaId: "memory:histories/agent-runs",
      type: "history",
      owner: "agent",
      writePolicy: "append_only",
      updatedAt: now,
      body: `# Agent Runs

<!-- Append-only dated log of notable runs. -->`,
    }),
  });

  files.push({
    relPath: "memory/histories/incidents.md",
    content: memoryDoc({
      somaId: "memory:histories/incidents",
      type: "history",
      owner: "agent",
      writePolicy: "append_only",
      updatedAt: now,
      body: `# Incidents

<!-- Append-only dated log of incidents. -->`,
    }),
  });

  return files;
}
