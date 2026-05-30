import { describe, it, expect, afterEach } from "vitest";
import { appendFact, readFacts, extractRelationship } from "../src/agent-core/index.js";
import { tmpWorkspace, cleanup, NOW } from "./helpers.js";
import type { Fact } from "../src/agent-core/index.js";

let ws: string;
afterEach(() => ws && cleanup(ws));

describe("facts", () => {
  it("extracts an ownership relationship", () => {
    const rel = extractRelationship("Payments is owned by the infra team");
    expect(rel).toEqual({
      type: "ownership",
      subject: "service:payments",
      predicate: "owned_by",
      object: "team:infra",
    });
  });

  it("returns null for free prose", () => {
    expect(extractRelationship("we are building the agentic core")).toBeNull();
  });

  it("appends and reads back a validated fact", () => {
    ws = tmpWorkspace();
    const fact: Fact = {
      id: "fact_test1",
      type: "ownership",
      subject: "service:payments",
      predicate: "owned_by",
      object: "team:infra",
      confidence: "high",
      source: { type: "user_statement", run_id: "run_001" },
      valid_from: NOW,
      created_at: NOW,
    };
    appendFact(ws, fact);
    const all = readFacts(ws);
    expect(all).toHaveLength(1);
    expect(all[0].subject).toBe("service:payments");
  });

  it("rejects an invalid fact", () => {
    ws = tmpWorkspace();
    // @ts-expect-error intentionally invalid
    expect(() => appendFact(ws, { id: "x" })).toThrow();
  });
});
