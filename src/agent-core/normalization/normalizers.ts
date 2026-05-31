import type { EntityRef, SomaEvent, SourceName } from "../types.js";
import { entityFromEmail, entityFromGithubUser, entityFromLinearUser, entityFromSlackUser, extractMentions } from "./entity-extract.js";
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
  // The update timestamp distinguishes successive edits of the same issue. When
  // it's absent, fall back to a content hash (not the receive time) so
  // re-ingesting an identical payload dedupes instead of creating a new event.
  const revision = asString(r.updated_at) ?? asString(issue.updatedAt) ?? stableHash(raw);
  return eventBase("linear", raw, {
    sourceEventId: `${id}:${revision}`,
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

/** Coerce a string-or-number id-like field to a string. */
function asIdLike(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return asString(value);
}

function normalizeGithubOne(raw: unknown, opts: NormalizeOptions): SomaEvent {
  const r = asRecord(raw);
  const pr = asRecord(r.pull_request);
  const issue = asRecord(r.issue);
  const subject = Object.keys(pr).length ? pr : issue;
  const repo =
    asString(asRecord(r.repository).full_name) ?? asString(r.repository) ?? "repo";
  const number = asIdLike(subject.number) ?? asIdLike(r.number);
  const action = asString(r.action);
  const id = number ?? asIdLike(subject.id) ?? stableHash(raw);
  const isPr = Boolean(Object.keys(pr).length || number);
  const title = asString(subject.title) ?? `${repo}#${id}`;
  const body = asString(subject.body) ?? "";
  const author = asString(asRecord(subject.user).login) ?? asString(asRecord(r.sender).login);
  // Prefer the subject's update time so re-delivered webhooks for the same
  // state dedupe; fall back to a content hash, never the receive time.
  const updatedAt = asString(subject.updated_at);
  const targets: EntityRef[] = number
    ? [{ id: `pr:${repo}#${number}`, kind: "pr", label: `${repo}#${number}` }]
    : [];
  return eventBase("github", raw, {
    sourceEventId: `${repo}#${id}:${updatedAt ?? stableHash(raw)}`,
    sourceUrl: asString(subject.html_url) ?? asString(subject.url),
    occurredAt: updatedAt ?? asString(subject.created_at) ?? opts.receivedAt,
    receivedAt: opts.receivedAt,
    kind: "pr_update",
    title: action ? `${title} (${action})` : title,
    text: `${title}\n\n${body}`,
    actor: author ? entityFromGithubUser(author) : undefined,
    targets,
    session: { key: `github:${repo}#${id}`, kind: isPr ? "code_review" : "support_thread" },
    visibility: { scope: "workspace" },
  });
}

function normalizeDatadogOne(raw: unknown, opts: NormalizeOptions): SomaEvent {
  const r = asRecord(raw);
  const service =
    asString(r.service) ?? asString(asRecord(r.attributes).service) ?? "unknown";
  const status = asString(r.status) ?? asString(r.alert_type) ?? "info";
  const message =
    asString(r.message) ?? asString(r.body) ?? asString(r.title) ?? asString(r.msg_text) ?? "";
  const occurredAt =
    asString(r.timestamp) ?? asString(r.date) ?? asIdLike(r.date_happened) ?? opts.receivedAt;
  // Stable id from the event's own identity, never the receive time.
  const id =
    asIdLike(r.id) ?? asIdLike(r.alert_id) ?? asIdLike(r.event_id) ?? stableHash({ raw });
  return eventBase("datadog", raw, {
    sourceEventId: id,
    sourceUrl: asString(r.url) ?? asString(r.link),
    occurredAt,
    receivedAt: opts.receivedAt,
    kind: "log",
    title: `Datadog ${service} [${status}]`,
    text: message,
    targets: service !== "unknown" ? [{ id: `service:${service}`, kind: "service", label: service }] : [],
    session: { key: `datadog:${service}`, kind: "support_thread" },
    visibility: { scope: "workspace" },
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
    github: normalizeGithubOne,
    datadog: normalizeDatadogOne,
  } satisfies Record<SourceName, (raw: unknown, opts: NormalizeOptions) => SomaEvent>;
  return values.map((v) => normalizeOne[source](v, opts));
}
