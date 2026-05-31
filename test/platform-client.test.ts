import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformClient, PlatformError } from "../src/agent-core/platform/client.js";
import { resolvePlatformConfig } from "../src/agent-core/platform/config.js";

const cfg = { baseUrl: "http://localhost:8787", adminToken: "tok", workspaceId: "ws_test" };

/** Stub global fetch; return the captured request + a canned response. */
function stubFetch(status: number, body: unknown) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  vi.stubGlobal("fetch", async (url: URL | string, init?: RequestInit) => {
    calls.push({ url: url.toString(), headers: (init?.headers ?? {}) as Record<string, string> });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("resolvePlatformConfig", () => {
  it("uses dev fallbacks when nothing is set", () => {
    const prev = { ...process.env };
    delete process.env.SOMA_BACKEND_URL;
    delete process.env.SOMA_ADMIN_TOKEN;
    delete process.env.SOMA_WORKSPACE_ID;
    delete process.env.NODE_ENV;
    const c = resolvePlatformConfig();
    expect(c.baseUrl).toBe("http://localhost:8787");
    expect(c.adminToken).toBe("dev-soma-admin-token-change-me");
    expect(c.workspaceId).toBe("ws_test");
    process.env = prev;
  });

  it("prefers explicit overrides over env", () => {
    const c = resolvePlatformConfig({ baseUrl: "http://x", workspaceId: "ws_9" });
    expect(c.baseUrl).toBe("http://x");
    expect(c.workspaceId).toBe("ws_9");
  });
});

describe("PlatformClient", () => {
  it("injects workspace_id + admin bearer and unwraps the envelope", async () => {
    const calls = stubFetch(200, { findings: [{ id: "f1" }] });
    const client = new PlatformClient(cfg);
    const findings = await client.listFindings();
    expect(findings).toEqual([{ id: "f1" }]);
    expect(calls[0]!.url).toContain("/v1/findings");
    expect(calls[0]!.url).toContain("workspace_id=ws_test");
    expect(calls[0]!.headers.authorization).toBe("Bearer tok");
  });

  it("passes receipt filters as query params", async () => {
    const calls = stubFetch(200, { receipts: [] });
    await new PlatformClient(cfg).listReceipts({
      source: "github",
      kind: "github.push",
      since: "2026-05-01T00:00:00Z",
      limit: 10,
      includePayload: true,
    });
    const url = calls[0]!.url;
    expect(url).toContain("source=github");
    expect(url).toContain("kind=github.push");
    expect(url).toContain("limit=10");
    expect(url).toContain("include=payload");
  });

  it("maps a 404 on people/activity to null (not an error)", async () => {
    stubFetch(404, { error: { message: "No activity found" } });
    const activity = await new PlatformClient(cfg).getPersonActivity("ghost");
    expect(activity).toBeNull();
  });

  it("throws PlatformError with status + backend message on other failures", async () => {
    stubFetch(400, { error: { message: "workspace_id required" } });
    await expect(new PlatformClient(cfg).listFindings()).rejects.toMatchObject({
      name: "PlatformError",
      status: 400,
    });
  });

  it("wraps a network failure as PlatformError(status 0)", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });
    const err = await new PlatformClient(cfg).listFindings().catch((e) => e);
    expect(err).toBeInstanceOf(PlatformError);
    expect((err as PlatformError).status).toBe(0);
    expect((err as PlatformError).message).toContain("cannot reach Soma backend");
  });

  it("getConnector encodes the source in the path", async () => {
    const calls = stubFetch(200, { source: "git hub" });
    await new PlatformClient(cfg).getConnector("git hub");
    expect(calls[0]!.url).toContain("/v1/status/connectors/git%20hub");
  });
});
