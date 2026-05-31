import fs from "node:fs";
import path from "node:path";
import { somaPaths } from "../paths.js";
import type { EntityRef, SomaEvent, StudyResult } from "../types.js";
import { readNormalizedEvents } from "./event-store.js";
import { readSession } from "./sessionize.js";

function uniqueEntities(events: SomaEvent[]): EntityRef[] {
  const seen = new Set<string>();
  const out: EntityRef[] = [];
  for (const entity of [
    ...events.flatMap((e) => e.actor ? [e.actor] : []),
    ...events.flatMap((e) => e.targets),
    ...events.flatMap((e) => e.mentions.map((m) => m.entity)),
  ]) {
    if (seen.has(entity.id)) continue;
    seen.add(entity.id);
    out.push(entity);
  }
  return out;
}

export function studySession(workspace: string, sessionId: string, now: string): StudyResult {
  const session = readSession(workspace, sessionId);
  if (!session) throw new Error(`session not found: ${sessionId}`);
  const eventSet = new Set(session.eventIds);
  const events = readNormalizedEvents(workspace).filter((e) => eventSet.has(e.id));
  const entities = uniqueEntities(events);
  const firstTicket = entities.find((e) => e.kind === "ticket");
  const firstPerson = entities.find((e) => e.kind === "person");
  const firstService = entities.find((e) => e.kind === "service");
  const evidenceEventIds = events.map((e) => e.id);
  const summary = `${session.title} has ${events.length} event(s), last active ${session.lastActivityAt}.`;

  const result: StudyResult = {
    sessionId,
    summary,
    involvedEntities: entities,
    proposedClaims: firstTicket && firstService
      ? [{
          subject: firstTicket.id,
          predicate: "relates_to",
          object: firstService.id,
          confidence: "medium",
        }]
      : [],
    currentStateUpdates: firstPerson
      ? [{
          subject: firstPerson.id,
          summary: firstTicket
            ? `${firstPerson.label} appears connected to ${firstTicket.label} in ${session.title}.`
            : `${firstPerson.label} appears active in ${session.title}.`,
          confidence: session.confidence >= 0.75 ? "high" : "medium",
        }]
      : [],
    openQuestions: session.importanceScore >= 0.75 && !firstTicket
      ? ["Session is important but not linked to a ticket yet."]
      : [],
    evidenceEventIds,
    confidence: session.confidence >= 0.75 ? "high" : "medium",
    createdAt: now,
  };

  const dir = somaPaths(workspace).study;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${sessionId}.json`), JSON.stringify(result, null, 2) + "\n", "utf8");
  return result;
}
