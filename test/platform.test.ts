import { describe, expect, it } from "vitest";
import { extractPersonQuery } from "../src/agent-core/platform/nl.js";
import {
  formatPersonActivity,
  formatFindings,
  formatTickets,
  formatConnectors,
  formatReceipts,
  formatCodeGraph,
  formatPeople,
} from "../src/agent-core/platform/format.js";
import type { PersonActivity } from "../src/agent-core/platform/types.js";

describe("extractPersonQuery", () => {
  it("pulls the person from common phrasings", () => {
    expect(extractPersonQuery("what is andy doing?")).toBe("andy");
    expect(extractPersonQuery("soma what is andy doing")).toBe("andy");
    expect(extractPersonQuery("what's andy working on lately")).toBe("andy");
    expect(extractPersonQuery("what is andy up to today?")).toBe("andy");
    expect(extractPersonQuery("who is bea?")).toBe("bea");
    expect(extractPersonQuery("what has andy@acme.com been doing")).toBe("andy@acme.com");
  });

  it("returns null for non-person questions", () => {
    expect(extractPersonQuery("what is the checkout error rate?")).toBeNull();
    expect(extractPersonQuery("list all findings")).toBeNull();
    expect(extractPersonQuery("")).toBeNull();
  });
});

describe("formatPersonActivity", () => {
  const activity: PersonActivity = {
    personId: "person:github:andy",
    label: "andy@acme.com",
    aliases: ["person:andy@acme.com", "person:github:andy"],
    counts: { pr: 2, commit: 1, issue: 0, review: 0, message: 1, incident: 0, meeting: 0, agent_run: 0, other: 0 },
    total: 4,
    firstSeenAt: "2026-05-28T10:00:00.000Z",
    lastSeenAt: "2026-05-30T12:00:00.000Z",
    timeline: [
      {
        receiptId: "r1",
        source: "github",
        kind: "github.pull_request",
        activity: "pr",
        title: "Fix checkout timeout",
        url: "https://gh/pr/1",
        occurredAt: "2026-05-30T12:00:00.000Z",
        businessObject: "acme/api",
      },
    ],
  };

  it("renders a readable summary", () => {
    const out = formatPersonActivity(activity);
    expect(out).toContain("andy@acme.com");
    expect(out).toContain("2 pr");
    expect(out).toContain("Fix checkout timeout");
  });

  it("returns the raw object as JSON when asked", () => {
    const out = formatPersonActivity(activity, { json: true });
    expect(JSON.parse(out)).toEqual(activity);
  });
});

describe("formatFindings", () => {
  it("handles the empty case", () => {
    expect(formatFindings([])).toBe("No findings.");
    expect(formatFindings([], { json: true })).toBe("[]");
  });
});

describe("other formatters", () => {
  it("empty states read clearly", () => {
    expect(formatTickets([])).toBe("No tickets.");
    expect(formatConnectors([])).toBe("No connectors.");
    expect(formatReceipts([])).toBe("No receipts.");
    expect(formatPeople([])).toBe("No people with recent activity.");
    expect(formatCodeGraph({ nodes: [], edges: [] })).toBe("Code graph is empty.");
  });

  it("connectors show a verified marker and event volume", () => {
    const out = formatConnectors([
      { source: "github", status: "live", first_event_at: "2026-05-30T00:00:00Z", last_event_at: "2026-05-30T01:00:00Z", event_count: 42, verified: true },
    ]);
    expect(out).toContain("github");
    expect(out).toContain("42 events");
    expect(out).toContain("✓");
  });

  it("receipts show kind + subject", () => {
    const out = formatReceipts([
      { id: "r1", source: "github", kind: "github.push", subject_id: "abc", business_object_id: "acme/api", occurred_at: "2026-05-30T00:00:00Z" },
    ]);
    expect(out).toContain("github.push");
    expect(out).toContain("@acme/api");
  });

  it("code graph summarizes node/edge counts", () => {
    const out = formatCodeGraph({
      nodes: [{ repo: "acme/api", node_key: "a", kind: "function", name: "handler", path: "src/a.ts", metadata: {} }],
      edges: [{ repo: "acme/api", src_key: "a", dst_key: "b", edge_type: "calls", metadata: {} }],
    });
    expect(out).toContain("1 nodes, 1 edges");
    expect(out).toContain("handler");
    expect(out).toContain("--calls-->");
  });

  it("all formatters round-trip data unchanged under --json", () => {
    const tickets = [{ id: "PAY-1", source: "linear" as const, external_id: "x", title: "t", status: "open", error_signature: null, updated_at: "" }];
    expect(JSON.parse(formatTickets(tickets, { json: true }))).toEqual(tickets);
    const people = [{ personId: "p", label: "p", aliases: ["p"], counts: { pr: 0, commit: 0, issue: 0, review: 0, message: 0, incident: 0, meeting: 0, agent_run: 0, other: 0 }, total: 0, firstSeenAt: null, lastSeenAt: null }];
    expect(JSON.parse(formatPeople(people, { json: true }))).toEqual(people);
  });
});
