import fs from "node:fs";
import path from "node:path";
import { somaPaths } from "../paths.js";
import type { EntityRef, SomaEvent, SomaSession } from "../types.js";
import { stableId } from "./ids.js";
import { scoreSessionImportance } from "./importance.js";

function fallbackSession(event: SomaEvent): { key: string; kind: SomaSession["kind"] } {
  const actor = event.actor?.id ?? "unknown";
  const hour = event.occurredAt.slice(0, 13);
  return { key: `${event.source}:${actor}:${hour}`, kind: "person_work" };
}

function uniqueRefs(refs: EntityRef[]): EntityRef[] {
  const seen = new Set<string>();
  const out: EntityRef[] = [];
  for (const ref of refs) {
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);
    out.push(ref);
  }
  return out;
}

function statusFor(lastActivityAt: string, kind: SomaSession["kind"]): SomaSession["status"] {
  if (kind === "meeting") return "closed";
  const ageMs = Date.now() - Date.parse(lastActivityAt);
  if (Number.isFinite(ageMs) && ageMs > 24 * 60 * 60 * 1000) return "quiet";
  return "active";
}

export function buildSessions(events: SomaEvent[]): SomaSession[] {
  const groups = new Map<string, SomaEvent[]>();
  for (const event of events) {
    const session = event.session ?? fallbackSession(event);
    const arr = groups.get(session.key) ?? [];
    arr.push(event);
    groups.set(session.key, arr);
  }

  const sessions: SomaSession[] = [];
  for (const [key, group] of groups) {
    group.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const first = group[0]!;
    const last = group[group.length - 1]!;
    const kind = first.session?.kind ?? fallbackSession(first).kind;
    const entities = uniqueRefs([
      ...group.flatMap((e) => e.actor ? [e.actor] : []),
      ...group.flatMap((e) => e.targets),
      ...group.flatMap((e) => e.mentions.map((m) => m.entity)),
    ]);
    const id = stableId("session", key);
    const base: SomaSession = {
      id,
      key,
      kind,
      title: first.title ?? key,
      startedAt: first.occurredAt,
      endedAt: kind === "meeting" ? last.occurredAt : undefined,
      lastActivityAt: last.occurredAt,
      eventIds: group.map((e) => e.id),
      actorIds: uniqueRefs(group.flatMap((e) => e.actor ? [e.actor] : [])).map((e) => e.id),
      objectIds: entities.map((e) => e.id),
      sourceRefs: group.map((e) => ({ source: e.source, sourceEventId: e.sourceEventId, url: e.sourceUrl })),
      importanceScore: 0,
      importanceReasons: [],
      confidence: key.includes(":unknown:") ? 0.35 : 0.8,
      status: statusFor(last.occurredAt, kind),
    };
    const decision = scoreSessionImportance(base, group);
    sessions.push({
      ...base,
      importanceScore: decision.score,
      importanceReasons: decision.reasons,
    });
  }

  return sessions.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

export function writeSessions(workspace: string, sessions: SomaSession[]): void {
  const dir = somaPaths(workspace).sessions;
  fs.mkdirSync(dir, { recursive: true });
  for (const session of sessions) {
    fs.writeFileSync(path.join(dir, `${session.id}.json`), JSON.stringify(session, null, 2) + "\n", "utf8");
  }
}

export function readSessions(workspace: string): SomaSession[] {
  const dir = somaPaths(workspace).sessions;
  if (!fs.existsSync(dir)) return [];
  const sessions: SomaSession[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    try {
      sessions.push(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as SomaSession);
    } catch {
      continue;
    }
  }
  return sessions.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

export function readSession(workspace: string, id: string): SomaSession | null {
  const file = path.join(somaPaths(workspace).sessions, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as SomaSession;
}
