import { describe, it, expect, afterEach } from "vitest";
import { cleanup, NOW, tmpWorkspace } from "./helpers.js";
import {
  ingestPayload,
  normalizePayload,
  readNormalizedEvents,
  readSessions,
  studySession,
} from "../src/agent-core/index.js";

let ws: string;
afterEach(() => ws && cleanup(ws));

describe("normalization and sessions", () => {
  it("normalizes Slack messages into canonical events with session keys", () => {
    const events = normalizePayload("slack", {
      ts: "1770000000.000100",
      thread_ts: "1770000000.000100",
      channel: "payments-oncall",
      user: "U123",
      text: "Priya is looking at PAY-418 checkout timeout",
    }, { receivedAt: NOW });

    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("slack");
    expect(events[0].session?.key).toBe("slack:payments-oncall:1770000000.000100");
    expect(events[0].mentions.map((m) => m.entity.id)).toContain("ticket:PAY-418");
    expect(events[0].mentions.map((m) => m.entity.id)).toContain("service:checkout");
  });

  it("dedupes events, writes sessions, and scores important work", () => {
    ws = tmpWorkspace();
    const payload = [
      {
        ts: "1770000000.000100",
        thread_ts: "1770000000.000100",
        channel: "payments-oncall",
        user: "U123",
        text: "Priya is blocked on PAY-418 checkout timeout",
      },
      {
        ts: "1770000060.000100",
        thread_ts: "1770000000.000100",
        channel: "payments-oncall",
        user: "U456",
        text: "PAY-418 still failing after deploy",
      },
    ];

    const first = ingestPayload(ws, "slack", payload, NOW);
    const second = ingestPayload(ws, "slack", payload, NOW);

    expect(first.fresh).toHaveLength(2);
    expect(second.fresh).toHaveLength(0);
    expect(readNormalizedEvents(ws)).toHaveLength(2);

    const sessions = readSessions(ws);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].eventIds).toHaveLength(2);
    expect(sessions[0].importanceScore).toBeGreaterThanOrEqual(0.75);
    expect(sessions[0].importanceReasons).toContain("ticket_link");
  });

  it("does not mistake an email domain for a mentioned person", () => {
    const events = normalizePayload("email", {
      message_id: "m1",
      from: "priya@company.com",
      to: ["ops@company.com"],
      subject: "Checkout",
      body: "see @oncall about this",
    }, { receivedAt: NOW });

    const ids = events[0].mentions.map((m) => m.entity.id);
    // The real @handle is captured, the email domains are not.
    expect(ids).toContain("person:oncall");
    expect(ids).not.toContain("person:company.com");
  });

  it("normalizes GitHub pull requests as code-review work", () => {
    const events = normalizePayload("github", {
      action: "opened",
      number: 42,
      pull_request: {
        number: 42,
        title: "Fix checkout timeout",
        html_url: "https://github.com/acme/api/pull/42",
        user: { login: "priya" },
        updated_at: NOW,
      },
      repository: { full_name: "acme/api" },
    }, { receivedAt: NOW });

    expect(events[0].kind).toBe("pr_update");
    expect(events[0].session?.kind).toBe("code_review");
    expect(events[0].session?.key).toBe("github:acme/api#42");
    expect(events[0].targets.map((t) => t.id)).toContain("pr:acme/api#42");
    expect(events[0].actor?.id).toBe("person:github:priya");
  });

  it("normalizes Datadog logs as log events scoped to a service", () => {
    const events = normalizePayload("datadog", {
      id: "evt-1",
      service: "payments",
      status: "error",
      message: "checkout timeout",
      timestamp: NOW,
    }, { receivedAt: NOW });

    expect(events[0].kind).toBe("log");
    expect(events[0].session?.key).toBe("datadog:payments");
    expect(events[0].targets.map((t) => t.id)).toContain("service:payments");
  });

  it("dedupes a re-ingested Linear payload that lacks an update timestamp", () => {
    ws = tmpWorkspace();
    const payload = {
      issue: {
        identifier: "PAY-9",
        title: "No timestamp",
        description: "body",
      },
    };
    const first = ingestPayload(ws, "linear", payload, NOW);
    const second = ingestPayload(ws, "linear", payload, NOW);
    expect(first.fresh).toHaveLength(1);
    expect(second.fresh).toHaveLength(0);
    expect(readNormalizedEvents(ws)).toHaveLength(1);
  });

  it("studies a session into evidence-backed current-state updates", () => {
    ws = tmpWorkspace();
    const result = ingestPayload(ws, "linear", {
      issue: {
        identifier: "PAY-418",
        title: "Checkout timeout regression",
        description: "Priya is investigating checkout timeout failures",
        assignee: { email: "priya@company.com" },
        updatedAt: NOW,
      },
      actor: { email: "priya@company.com" },
    }, NOW);

    const studied = studySession(ws, result.sessions[0].id, NOW);

    expect(studied.sessionId).toBe(result.sessions[0].id);
    expect(studied.evidenceEventIds).toHaveLength(1);
    expect(studied.currentStateUpdates[0].subject).toBe("person:priya@company.com");
    expect(studied.proposedClaims[0].subject).toBe("ticket:PAY-418");
  });
});
