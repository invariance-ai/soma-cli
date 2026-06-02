/**
 * Shared formatter for platform data. Pure string builders (no console) so the
 * CLI (human default + --json) and the MCP server (text summary + structured
 * JSON) render identically and never drift. Every function honors
 * `{ json: true }` by returning pretty JSON of the same data.
 */

import type {
  ActivityKind,
  BackendFinding,
  BackendLog,
  BackendTicket,
  CodeGraph,
  ConnectorStatus,
  Dashboard,
  LogStreamSummary,
  PersonActivity,
  PersonSummary,
  ReceiptRow,
} from "./types.js";

export interface FormatOpts {
  json?: boolean;
}

function json(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function shortTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.replace("T", " ").replace(/\.\d+Z$/, "Z");
}

function countsLine(counts: Record<ActivityKind, number>): string {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
}

export function formatLogs(rows: BackendLog[], o: FormatOpts = {}): string {
  if (o.json) return json(rows);
  if (rows.length === 0) return "No logs.";
  return rows
    .map((l) => {
      const lvl = (l.level ?? "info").toUpperCase().padEnd(5);
      const svc = (l.service ?? "—").padEnd(14);
      const meta =
        l.status != null
          ? `  (${l.status})`
          : l.duration_ms != null
            ? `  (${l.duration_ms}ms)`
            : "";
      return `${shortTime(l.ts)}  ${lvl} ${svc} ${l.message}${meta}`;
    })
    .join("\n");
}

export function formatLogStreams(rows: LogStreamSummary[], o: FormatOpts = {}): string {
  if (o.json) return json(rows);
  if (rows.length === 0) return "No log streams.";
  return rows
    .map(
      (s) =>
        `${s.name.padEnd(22)} ${String(s.count).padStart(7)} events${
          s.errorCount ? `  · ${s.errorCount} errors` : ""
        }`,
    )
    .join("\n");
}

export function formatDashboards(rows: Dashboard[], o: FormatOpts = {}): string {
  if (o.json) return json(rows);
  if (rows.length === 0) return "No dashboards.";
  return rows
    .map(
      (d) =>
        `${d.name.padEnd(24)} ${d.slug.padEnd(20)} ${
          Array.isArray(d.tiles) ? d.tiles.length : 0
        } tiles`,
    )
    .join("\n");
}

export function formatFindings(rows: BackendFinding[], o: FormatOpts = {}): string {
  if (o.json) return json(rows);
  if (rows.length === 0) return "No findings.";
  return rows
    .map((f) => {
      const ticket = f.matched_ticket ? `  ↳ ticket ${f.matched_ticket.id} (${f.matched_ticket.status})` : "";
      const head = `[${f.severity}] ${f.title}  · ${f.status} · ${f.event_count} events`;
      const meta = `  ${f.service ?? "—"} · sources: ${f.sources.join(", ") || "—"} · last ${shortTime(f.last_seen_at)}`;
      return [head, meta, f.summary ? `  ${f.summary}` : "", ticket].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

export function formatTickets(rows: BackendTicket[], o: FormatOpts = {}): string {
  if (o.json) return json(rows);
  if (rows.length === 0) return "No tickets.";
  return rows
    .map((t) => `${t.id.padEnd(16)} ${t.status.padEnd(12)} ${t.source.padEnd(7)} ${t.title}`)
    .join("\n");
}

export function formatConnectors(rows: ConnectorStatus[], o: FormatOpts = {}): string {
  if (o.json) return json(rows);
  if (rows.length === 0) return "No connectors.";
  return rows
    .map((c) => {
      const verified = c.verified ? "✓" : c.first_event_at ? "·" : "…";
      const err = c.last_error ? `  ⚠ ${c.last_error}` : "";
      return `${verified} ${c.source.padEnd(13)} ${c.status.padEnd(13)} ${String(c.event_count).padStart(6)} events · last ${shortTime(c.last_event_at)}${err}`;
    })
    .join("\n");
}

export function formatReceipts(rows: ReceiptRow[], o: FormatOpts = {}): string {
  if (o.json) return json(rows);
  if (rows.length === 0) return "No receipts.";
  return rows
    .map((r) => {
      const subj = r.subject_id ? ` ${r.subject_id}` : "";
      const obj = r.business_object_id ? ` @${r.business_object_id}` : "";
      const sig = r.error_signature ? `  !${r.error_signature}` : "";
      return `${shortTime(r.occurred_at ?? r.received_at)}  ${r.kind.padEnd(22)}${subj}${obj}${sig}`;
    })
    .join("\n");
}

export function formatCodeGraph(graph: CodeGraph, o: FormatOpts = {}): string {
  if (o.json) return json(graph);
  if (graph.nodes.length === 0 && graph.edges.length === 0) return "Code graph is empty.";
  const nodeLines = graph.nodes
    .slice(0, 50)
    .map((n) => `  ${n.kind.padEnd(10)} ${n.name ?? n.node_key}${n.path ? `  (${n.path})` : ""}`);
  const edgeLines = graph.edges
    .slice(0, 50)
    .map((e) => `  ${e.src_key} --${e.edge_type}--> ${e.dst_key}`);
  return [
    `${graph.nodes.length} nodes, ${graph.edges.length} edges`,
    nodeLines.length ? "\nNodes:" : "",
    ...nodeLines,
    edgeLines.length ? "\nEdges:" : "",
    ...edgeLines,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatPeople(rows: PersonSummary[], o: FormatOpts = {}): string {
  if (o.json) return json(rows);
  if (rows.length === 0) return "No people with recent activity.";
  return rows
    .map((p) => `${p.label.padEnd(28)} ${String(p.total).padStart(4)} events · ${countsLine(p.counts)} · last ${shortTime(p.lastSeenAt)}`)
    .join("\n");
}

/** The "what is <person> doing?" view. */
export function formatPersonActivity(a: PersonActivity, o: FormatOpts = {}): string {
  if (o.json) return json(a);
  const header = `${a.label} — ${a.total} events (${countsLine(a.counts) || "none"})`;
  const window = `active ${shortTime(a.firstSeenAt)} → ${shortTime(a.lastSeenAt)}`;
  const aliases = a.aliases.length > 1 ? `aliases: ${a.aliases.join(", ")}` : "";
  const lines = a.timeline
    .map((e) => {
      const url = e.url ? `  ${e.url}` : "";
      const obj = e.businessObject ? ` @${e.businessObject}` : "";
      return `  ${shortTime(e.occurredAt)}  ${e.activity.padEnd(9)} ${e.title ?? e.kind}${obj}${url}`;
    });
  return [header, window, aliases, "", "Recent:", ...lines].filter(Boolean).join("\n");
}
