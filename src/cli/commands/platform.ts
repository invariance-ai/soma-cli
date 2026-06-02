/**
 * CLI commands that surface the Soma platform backend — the same data the
 * dashboard shows (findings, tickets, connectors, raw receipts, code graph,
 * people activity). Every command renders a readable view by default and raw
 * JSON with --json, via the shared formatter so CLI and MCP never drift.
 */

import {
  platformClientFromEnv,
  PlatformError,
  formatFindings,
  formatTickets,
  formatConnectors,
  formatReceipts,
  formatCodeGraph,
  formatPeople,
  formatPersonActivity,
  formatLogs,
  formatLogStreams,
  formatDashboards,
} from "../../agent-core/index.js";
import type { PlatformClient } from "../../agent-core/index.js";

/** Options shared by every platform command. */
export interface PlatformOpts {
  json?: boolean;
  /** Override the platform workspace id (else SOMA_WORKSPACE_ID / dev fallback). */
  workspaceId?: string;
  /** Override the backend base URL (else SOMA_BACKEND_URL / dev fallback). */
  backend?: string;
}

function makeClient(opts: PlatformOpts): PlatformClient {
  return platformClientFromEnv({
    workspaceId: opts.workspaceId,
    baseUrl: opts.backend,
  });
}

/** Run a platform command, turning backend errors into clean CLI failures. */
async function withClient(opts: PlatformOpts, fn: (c: PlatformClient) => Promise<string>): Promise<void> {
  try {
    console.log(await fn(makeClient(opts)));
  } catch (err) {
    if (err instanceof PlatformError) {
      console.error(`soma: ${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

export function cmdFindings(opts: PlatformOpts): Promise<void> {
  return withClient(opts, async (c) => formatFindings(await c.listFindings(), opts));
}

export function cmdTickets(opts: PlatformOpts): Promise<void> {
  return withClient(opts, async (c) => formatTickets(await c.listTickets(), opts));
}

export function cmdConnectors(source: string | undefined, opts: PlatformOpts): Promise<void> {
  return withClient(opts, async (c) => {
    if (source) return formatConnectors([await c.getConnector(source)], opts);
    return formatConnectors(await c.listConnectors(), opts);
  });
}

export interface LogsCmdOpts extends PlatformOpts {
  stream?: string;
  level?: string;
  service?: string;
  env?: string;
  q?: string;
  since?: string;
  limit?: string;
}

export function cmdLogs(opts: LogsCmdOpts): Promise<void> {
  return withClient(opts, async (c) =>
    formatLogs(
      await c.listLogs({
        stream: opts.stream,
        level: opts.level,
        service: opts.service,
        env: opts.env,
        q: opts.q,
        since: opts.since,
        limit: opts.limit ? Number(opts.limit) : undefined,
      }),
      opts,
    ),
  );
}

export function cmdLogStreams(opts: PlatformOpts): Promise<void> {
  return withClient(opts, async (c) => formatLogStreams(await c.listLogStreams(), opts));
}

export function cmdDashboards(opts: PlatformOpts): Promise<void> {
  return withClient(opts, async (c) => formatDashboards(await c.listDashboards(), opts));
}

export interface ReceiptsCmdOpts extends PlatformOpts {
  source?: string;
  kind?: string;
  since?: string;
  limit?: string;
}

export function cmdReceipts(opts: ReceiptsCmdOpts): Promise<void> {
  return withClient(opts, async (c) =>
    formatReceipts(
      await c.listReceipts({
        source: opts.source,
        kind: opts.kind,
        since: opts.since,
        limit: opts.limit ? Number(opts.limit) : undefined,
      }),
      opts,
    ),
  );
}

export interface CodeGraphCmdOpts extends PlatformOpts {
  repo?: string;
  nodeKind?: string;
}

export function cmdCodeGraph(opts: CodeGraphCmdOpts): Promise<void> {
  return withClient(opts, async (c) =>
    formatCodeGraph(await c.getCodeGraph({ repo: opts.repo, nodeKind: opts.nodeKind }), opts),
  );
}

export interface PeopleCmdOpts extends PlatformOpts {
  since?: string;
}

export function cmdPeople(opts: PeopleCmdOpts): Promise<void> {
  return withClient(opts, async (c) => formatPeople(await c.listPeople(opts.since), opts));
}

export interface WhoCmdOpts extends PlatformOpts {
  since?: string;
  limit?: string;
}

/** Deterministic "what is <person> doing" — no model, just the aggregated view. */
export function cmdWho(person: string, opts: WhoCmdOpts): Promise<void> {
  return withClient(opts, async (c) => {
    const activity = await c.getPersonActivity(person, {
      since: opts.since,
      limit: opts.limit ? Number(opts.limit) : undefined,
    });
    if (!activity) {
      return opts.json ? "null" : `No recent activity found for "${person}".`;
    }
    return formatPersonActivity(activity, opts);
  });
}
