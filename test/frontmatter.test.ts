import { describe, it, expect } from "vitest";
import { parseMemory, stringifyMemory } from "../src/agent-core/index.js";

describe("frontmatter", () => {
  it("parses typed meta + body", () => {
    const raw = `---\nsoma_id: memory:projects/soma\ntype: project_memory\nowner: agent\nwrite_policy: agent_editable\n---\n\n# Soma\n\nBody text.`;
    const { meta, body } = parseMemory(raw, "projects/soma.md");
    expect(meta.soma_id).toBe("memory:projects/soma");
    expect(meta.write_policy).toBe("agent_editable");
    expect(body).toContain("# Soma");
  });

  it("falls back to human_approved on missing/invalid policy", () => {
    const { meta } = parseMemory("# No frontmatter", "x.md");
    expect(meta.write_policy).toBe("human_approved");
    expect(meta.soma_id).toBe("memory:x");
  });

  it("round-trips through stringify", () => {
    const raw = `---\nsoma_id: memory:a\ntype: t\nowner: agent\nwrite_policy: append_only\n---\n\nHello`;
    const { meta, body } = parseMemory(raw, "a.md");
    const out = stringifyMemory(meta, body);
    const reparsed = parseMemory(out, "a.md");
    expect(reparsed.meta.write_policy).toBe("append_only");
    expect(reparsed.body).toBe("Hello");
  });
});
