/**
 * Typed client for the Soma platform backend's admin read API. One method per
 * dashboard data surface so the CLI and MCP share a single source of truth for
 * how to reach the backend (and never drift in auth/query shape).
 */

import { resolvePlatformConfig, type PlatformConfig, type PlatformConfigOverrides } from "./config.js";
import type {
  BackendFinding,
  BackendTicket,
  CodeGraph,
  ConnectorStatus,
  PersonActivity,
  PersonSummary,
  ReceiptRow,
} from "./types.js";

export interface ReceiptQuery {
  source?: string;
  kind?: string;
  since?: string;
  subjectId?: string;
  businessObjectId?: string;
  limit?: number;
  includePayload?: boolean;
}

export interface CodeGraphQuery {
  repo?: string;
  nodeKind?: string;
  limit?: number;
}

export interface PersonActivityQuery {
  since?: string;
  limit?: number;
}

/** Raised when the backend returns a non-2xx response. `status` is the HTTP code. */
export class PlatformError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "PlatformError";
  }
}

export class PlatformClient {
  constructor(private readonly cfg: PlatformConfig) {}

  get workspaceId(): string {
    return this.cfg.workspaceId;
  }

  private async get<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T> {
    const url = new URL(path, this.cfg.baseUrl);
    url.searchParams.set("workspace_id", this.cfg.workspaceId);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { authorization: `Bearer ${this.cfg.adminToken}` },
      });
    } catch (err) {
      throw new PlatformError(
        `cannot reach Soma backend at ${this.cfg.baseUrl} (${err instanceof Error ? err.message : String(err)})`,
        0,
        path,
      );
    }
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        detail = body?.error?.message ? `: ${body.error.message}` : "";
      } catch {
        /* non-json body */
      }
      throw new PlatformError(`GET ${path} → ${res.status}${detail}`, res.status, path);
    }
    return (await res.json()) as T;
  }

  async listFindings(): Promise<BackendFinding[]> {
    return (await this.get<{ findings: BackendFinding[] }>("/v1/findings")).findings;
  }

  async listTickets(): Promise<BackendTicket[]> {
    return (await this.get<{ tickets: BackendTicket[] }>("/v1/tickets")).tickets;
  }

  async listConnectors(): Promise<ConnectorStatus[]> {
    return (await this.get<{ connectors: ConnectorStatus[] }>("/v1/status/connectors")).connectors;
  }

  async getConnector(source: string): Promise<ConnectorStatus> {
    return this.get<ConnectorStatus>(`/v1/status/connectors/${encodeURIComponent(source)}`);
  }

  async listReceipts(q: ReceiptQuery = {}): Promise<ReceiptRow[]> {
    return (
      await this.get<{ receipts: ReceiptRow[] }>("/v1/receipts", {
        source: q.source,
        kind: q.kind,
        since: q.since,
        subject_id: q.subjectId,
        business_object_id: q.businessObjectId,
        limit: q.limit?.toString(),
        include: q.includePayload ? "payload" : undefined,
      })
    ).receipts;
  }

  async getCodeGraph(q: CodeGraphQuery = {}): Promise<CodeGraph> {
    return this.get<CodeGraph>("/v1/code-graph", {
      repo: q.repo,
      node_kind: q.nodeKind,
      limit: q.limit?.toString(),
    });
  }

  async listPeople(since?: string): Promise<PersonSummary[]> {
    return (await this.get<{ people: PersonSummary[] }>("/v1/people", { since })).people;
  }

  /** Returns null when nobody matches (backend 404), rather than throwing. */
  async getPersonActivity(person: string, q: PersonActivityQuery = {}): Promise<PersonActivity | null> {
    try {
      return (
        await this.get<{ activity: PersonActivity }>("/v1/people/activity", {
          person,
          since: q.since,
          limit: q.limit?.toString(),
        })
      ).activity;
    } catch (err) {
      if (err instanceof PlatformError && err.status === 404) return null;
      throw err;
    }
  }
}

/** Build a client from env/dev-fallback config, with optional overrides. */
export function platformClientFromEnv(overrides: PlatformConfigOverrides = {}): PlatformClient {
  return new PlatformClient(resolvePlatformConfig(overrides));
}
