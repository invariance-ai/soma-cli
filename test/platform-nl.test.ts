import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformClient } from "../src/agent-core/platform/client.js";
import { answerPersonQuestion } from "../src/agent-core/platform/nl.js";
import type { PersonActivity } from "../src/agent-core/platform/types.js";

const cfg = { baseUrl: "http://localhost:8787", adminToken: "tok", workspaceId: "ws_test" };

const ACTIVITY: PersonActivity = {
  personId: "person:github:andy",
  label: "andy@acme.com",
  aliases: ["person:github:andy", "person:andy@acme.com"],
  counts: { pr: 1, commit: 0, issue: 0, review: 0, message: 1, incident: 0, meeting: 0, agent_run: 0, other: 0 },
  total: 2,
  firstSeenAt: "2026-05-30T09:00:00.000Z",
  lastSeenAt: "2026-05-30T12:00:00.000Z",
  timeline: [
    { receiptId: "r1", source: "github", kind: "github.pull_request", activity: "pr", title: "Fix checkout", url: null, occurredAt: "2026-05-30T12:00:00.000Z", businessObject: "acme/api" },
  ],
};

function stubActivity(body: unknown, status = 200) {
  vi.stubGlobal("fetch", async () => ({ ok: status < 300, status, json: async () => body }) as Response);
}

afterEach(() => vi.unstubAllGlobals());

describe("answerPersonQuestion", () => {
  it("returns the deterministic formatted view when noModel is set", async () => {
    stubActivity({ activity: ACTIVITY });
    const res = await answerPersonQuestion(new PlatformClient(cfg), "what is andy doing?", "andy", {
      noModel: true,
    });
    expect(res.source).toBe("deterministic");
    expect(res.activity).toEqual(ACTIVITY);
    expect(res.answer).toContain("andy@acme.com");
    expect(res.answer).toContain("Fix checkout");
  });

  it("handles a person with no activity (404 → null)", async () => {
    stubActivity({ error: { message: "none" } }, 404);
    const res = await answerPersonQuestion(new PlatformClient(cfg), "what is ghost doing?", "ghost", {
      noModel: true,
    });
    expect(res.activity).toBeNull();
    expect(res.source).toBe("deterministic");
    expect(res.answer).toMatch(/no recent activity/i);
  });
});
