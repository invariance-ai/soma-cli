/**
 * Types for the Soma platform backend's admin read API (`/v1/*`). These mirror
 * the JSON the dashboard already consumes, so the CLI and MCP surface the exact
 * same data. Field names are snake_case to match the backend wire format.
 */

export type Severity = "critical" | "high" | "medium" | "low";

export interface BackendFinding {
  id: string;
  cluster_key: string;
  type: string;
  error_signature: string | null;
  service: string | null;
  title: string;
  summary: string;
  severity: Severity;
  status: string;
  event_count: number;
  source_count: number;
  sources: string[];
  first_seen_at: string | null;
  last_seen_at: string | null;
  evidence: string[];
  evidence_receipt_ids: string[];
  correlated_deploy: unknown | null;
  matched_ticket: BackendTicketMatch | null;
  confidence?: number;
}

export interface BackendTicketMatch {
  id: string;
  source: "linear" | "github";
  status: string;
  title: string;
  url?: string;
}

export interface BackendTicket {
  id: string;
  source: "linear" | "github";
  external_id: string;
  title: string;
  status: string;
  url?: string;
  error_signature: string | null;
  updated_at: string;
}

export interface ConnectorStatus {
  source: string;
  status: string;
  first_event_at: string | null;
  last_event_at: string | null;
  last_error?: string | null;
  event_count: number;
  verified?: boolean;
}

export interface ReceiptRow {
  id: string;
  source: string;
  kind: string;
  external_id?: string | null;
  occurred_at?: string | null;
  received_at?: string | null;
  subject_type?: string | null;
  subject_id?: string | null;
  business_object_type?: string | null;
  business_object_id?: string | null;
  correlation_keys?: Record<string, unknown> | null;
  error_signature?: string | null;
  metadata?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
}

export interface CodeNode {
  repo: string;
  node_key: string;
  kind: string;
  name: string | null;
  path: string | null;
  metadata: Record<string, unknown>;
}

export interface CodeEdge {
  repo: string;
  src_key: string;
  dst_key: string;
  edge_type: string;
  metadata: Record<string, unknown>;
}

export interface CodeGraph {
  nodes: CodeNode[];
  edges: CodeEdge[];
}

export type ActivityKind =
  | "pr"
  | "commit"
  | "issue"
  | "review"
  | "message"
  | "incident"
  | "meeting"
  | "agent_run"
  | "other";

export interface ActivityEvent {
  receiptId: string;
  source: string;
  kind: string;
  activity: ActivityKind;
  title: string | null;
  url: string | null;
  occurredAt: string;
  businessObject: string | null;
}

export interface PersonSummary {
  personId: string;
  label: string;
  aliases: string[];
  counts: Record<ActivityKind, number>;
  total: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface PersonActivity extends PersonSummary {
  timeline: ActivityEvent[];
}
