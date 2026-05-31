import type { EntityRef, SomaEvent, SourceName } from "../types.js";
import { entityFromEmail, entityFromLinearUser, entityFromSlackUser, extractMentions } from "./entity-extract.js";
import { asRecord, asString, asStringArray, stableHash, stableId } from "./ids.js";

export interface NormalizeOptions {
  receivedAt: string;
}

function eventBase(
  source: SourceName,
  raw: unknown,
  fields: Omit<SomaEvent, "id" | "source" | "dedupeKey" | "contentHash" | "raw" | "targets" | "mentions"> & {
    targets?: EntityRef[];
    text?: string;
  },
): SomaEvent {
  const contentHash = stableHash({ source, raw });
  const dedupeKey = `${source}:${fields.sourceEventId}`;
  const text = fields.text ?? fields.title ?? "";
  return {
    ...fields,
    id: stableId("event", dedupeKey),
    source,
    targets: fields.targets ?? [],
    mentions: extractMentions(text),
    dedupeKey,
    contentHash,
    raw,
  };
}

function normalizeSlackOne(raw: unknown, opts: NormalizeOptions): SomaEvent {
  const r = asRecord(raw);
  const ts = asString(r.ts) ?? asString(r.event_ts) ?? opts.receivedAt;
  const channel = asString(r.channel) ?? asString(r.channel_name) ?? "unknown";
  const threadTs = asString(r.thread_ts) ?? ts;
  const text = asString(r.text) ?? "";
  const user = asString(r.user) ?? asString(r.username);
  const occurredAt = /^\d+\.\d+$/.test(ts) ? new Date(Number(ts.split(".")[0]) * 1000).toISOString() : ts;
  return eventBase("slack", raw, {
    sourceEventId: `${channel}:${ts}`,
    sourceUrl: asString(r.permalink),
    occurredAt,
    receivedAt: opts.receivedAt,
    kind: "message",
    title: `Slack #${channel}`,
    text,
    actor: user ? entityFromSlackUser(user) : undefined,
    session: { key: `slack:${channel}:${threadTs}`, kind: "person_work" },
    visibility: { scope: "channel", sourceAclRef: channel },
  });
}

function normalizeGranolaOne(raw: unknown, opts: NormalizeOptions): SomaEvent {
  const r = asRecord(raw);
  const id = asString(r.id) ?? asString(r.note_id) ?? stableHash(raw);
  const title = asString(r.title) ?? asString(r.meeting_title) ?? "Granola note";
  const text = [asString(r.summary), asString(r.transcript), asString(r.text), asString(r.body)]
    .filter(Boolean)
    .join("\n\n");
  const occurredAt = asString(r.started_at) ?? asString(r.created_at) ?? opts.receivedAt;
  const targets = asStringArray(r.participants).map(entityFromEmail);
  return eventBase("granola", raw, {
    sourceEventId: id,
    sourceUrl: asString(r.url),
    occurredAt,
    receivedAt: opts.receivedAt,
    kind: "meeting_note",
    title,
    text,
    targets,
    session: { key: `granola:${id}`, kind: "meeting" },
    visibility: { scope: "team" },
  });
}

function normalizeEmailOne(raw: unknown, opts: NormalizeOptions): SomaEvent {
  const r = asRecord(raw);
  const id = asString(r.message_id) ?? asString(r.id) ?? stableHash(raw);
  const threadId = asString(r.thread_id) ?? id;
  const from = asString(r.from);
  const recipients = [...asStringArray(r.to), ...asStringArray(r.cc)];
  const subject = asString(r.subject) ?? "Email";
  const text = [subject, asString(r.body), asString(r.snippet)].filter(Boolean).join("\n\n");
  return eventBase("email", raw, {
    sourceEventId: id,
    occurredAt: asString(r.date) ?? asString(r.timestamp) ?? opts.receivedAt,
    receivedAt: opts.receivedAt,
    kind: "email",
    title: subject,
    text,
    actor: from ? entityFromEmail(from) : undefined,
    targets: recipients.map(entityFromEmail),
    session: { key: `email:${threadId}`, kind: "person_work" },
    visibility: { scope: "private" },
  });
}

function normalizeLinearOne(raw: unknown, opts: NormalizeOptions): SomaEvent {
  const r = asRecord(raw);
  const issue = asRecord(r.issue ?? raw);
  const id = asString(issue.identifier) ?? asString(issue.id) ?? stableHash(raw);
  const title = asString(issue.title) ?? `Linear ${id}`;
  const description = asString(issue.description) ?? asString(r.body) ?? asString(r.comment) ?? "";
  const assignee = asRecord(issue.assignee);
  const actor = asRecord(r.actor);
  const targets: EntityRef[] = [{ id: `ticket:${id.toUpperCase()}`, kind: "ticket", label: id.toUpperCase() }];
  const assigneeLabel = asString(assignee.email) ?? asString(assignee.name);
  if (assigneeLabel) targets.push(entityFromLinearUser(assigneeLabel));
  return eventBase("linear", raw, {
    sourceEventId: `${id}:${asString(r.updated_at) ?? asString(issue.updatedAt) ?? opts.receivedAt}`,
    sourceUrl: asString(issue.url),
    occurredAt: asString(r.updated_at) ?? asString(issue.updatedAt) ?? asString(issue.createdAt) ?? opts.receivedAt,
    receivedAt: opts.receivedAt,
    kind: "ticket_update",
    title,
    text: `${title}\n\n${description}`,
    actor: asString(actor.email) ? entityFromLinearUser(asString(actor.email)!) : undefined,
    targets,
    session: { key: `linear:${id.toUpperCase()}`, kind: "ticket_work" },
    visibility: { scope: "team" },
  });
}

function normalizeAgentOne(raw: unknown, opts: NormalizeOptions): SomaEvent {
  const r = asRecord(raw);
  const runId = asString(r.run_id) ?? asString(r.runId) ?? asString(r.id) ?? stableHash(raw);
  const stepId = asString(r.step_id) ?? asString(r.stepId) ?? asString(r.tool_call_id) ?? runId;
  const tool = asString(r.tool) ?? asString(r.name) ?? "agent_step";
  const text = [tool, asString(r.input), asString(r.output), asString(r.summary)].filter(Boolean).join("\n\n");
  return eventBase("agent", raw, {
    sourceEventId: `${runId}:${stepId}`,
    occurredAt: asString(r.timestamp) ?? asString(r.created_at) ?? opts.receivedAt,
    receivedAt: opts.receivedAt,
    kind: "agent_step",
    title: `Agent run ${runId}`,
    text,
    session: { key: `agent:${runId}`, kind: "agent_run" },
    visibility: { scope: "workspace" },
  });
}

export function normalizePayload(source: SourceName, payload: unknown, opts: NormalizeOptions): SomaEvent[] {
  const values = Array.isArray(payload) ? payload : [payload];
  const normalizeOne = {
    slack: normalizeSlackOne,
    granola: normalizeGranolaOne,
    email: normalizeEmailOne,
    linear: normalizeLinearOne,
    agent: normalizeAgentOne,
    github: normalizeAgentOne,
    datadog: normalizeAgentOne,
  } satisfies Record<SourceName, (raw: unknown, opts: NormalizeOptions) => SomaEvent>;
  return values.map((v) => normalizeOne[source](v, opts));
}
