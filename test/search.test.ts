import { describe, it, expect, afterEach } from "vitest";
import { searchMemory } from "../src/agent-core/index.js";
import { tmpWorkspace, cleanup } from "./helpers.js";

let ws: string;
afterEach(() => ws && cleanup(ws));

describe("memory search", () => {
  it("ranks title/heading matches above body matches", () => {
    ws = tmpWorkspace();
    const hits = searchMemory(ws, "soma");
    expect(hits.length).toBeGreaterThan(0);
    // projects/soma.md has "Soma" in the title -> should top the list.
    expect(hits[0].file.relPath).toBe("projects/soma.md");
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it("returns empty for no match", () => {
    ws = tmpWorkspace();
    expect(searchMemory(ws, "zzzznotpresent")).toHaveLength(0);
  });

  it("produces a citation-ready snippet", () => {
    ws = tmpWorkspace();
    const hits = searchMemory(ws, "queryability");
    expect(hits[0].snippet).toContain("queryability");
  });
});
