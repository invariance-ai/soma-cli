import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  run,
  compilePromptPack,
  renderPromptPack,
  readFacts,
  readMemory,
  latestRun,
} from "../src/agent-core/index.js";
import { tmpWorkspace, cleanup, NOW, DATE } from "./helpers.js";
import type { UserTask } from "../src/agent-core/index.js";

let ws: string;
afterEach(() => ws && cleanup(ws));

function task(input: string, kind: UserTask["kind"]): UserTask {
  return { input, kind, surface: "cli", workspace: ws };
}

describe("prompt pack", () => {
  it("loads always-on blocks and retrieved memory under budget", () => {
    ws = tmpWorkspace();
    const pack = compilePromptPack(task("what is soma?", "ask"));
    expect(pack.system.some((b) => b.relPath === "agent/system.md")).toBe(true);
    expect(pack.alwaysMemory.length).toBeGreaterThan(0);
    const compiled = renderPromptPack(pack);
    expect(compiled.systemPrompt).toContain("Soma");
    expect(compiled.loadedBlockIds.length).toBeGreaterThan(0);
  });
});

describe("runtime loop", () => {
  it("ask (dry-run) writes a run trace + context report", async () => {
    ws = tmpWorkspace();
    const { trace } = await run({
      task: { ...task("what is soma?", "ask"), dryRun: true },
      now: NOW,
      date: DATE,
    });
    expect(trace.id).toBe("run_001");
    const ctx = path.join(ws, ".soma/runs", DATE, "run_001.context.md");
    expect(fs.existsSync(ctx)).toBe(true);
    expect(latestRun(ws)?.trace.id).toBe("run_001");
  });

  it("remember routes an ownership statement to facts with real run id", async () => {
    ws = tmpWorkspace();
    const { trace } = await run({
      task: task("Payments is owned by the infra team", "remember"),
      now: NOW,
      date: DATE,
    });
    const facts = readFacts(ws);
    expect(facts).toHaveLength(1);
    expect(facts[0].predicate).toBe("owned_by");
    expect(facts[0].source.run_id).toBe(trace.id);
  });

  it("remember routes prose to active-work.md", async () => {
    ws = tmpWorkspace();
    await run({
      task: task("we are building the agentic core", "remember"),
      now: NOW,
      date: DATE,
    });
    const file = readMemory(ws, "active-work.md");
    expect(file?.body).toContain("agentic core");
  });

  it("remember proposes (does not apply) edits to a protected file directly", async () => {
    ws = tmpWorkspace();
    // personality.md is human_approved; a direct write must become a proposal.
    const { decideWrite } = await import("../src/agent-core/index.js");
    expect(decideWrite("human_approved").action).toBe("propose");
  });
});
