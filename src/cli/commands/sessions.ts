import { readNormalizedEvents, readSession, readSessions, studySession } from "../../agent-core/index.js";
import { nowIso } from "../clock.js";

export function cmdSessionsList(workspace: string, opts: { limit?: string; person?: string }): void {
  const limit = opts.limit ? parseInt(opts.limit, 10) : 12;
  const person = opts.person?.toLowerCase();
  const sessions = readSessions(workspace)
    .filter((s) => {
      if (!person) return true;
      return s.objectIds.some((id) => id.toLowerCase().includes(person));
    })
    .slice(0, Number.isFinite(limit) ? limit : 12);

  if (sessions.length === 0) {
    console.log("No sessions found.");
    return;
  }

  for (const s of sessions) {
    console.log(`${s.id}  ${s.status.padEnd(6)}  ${s.importanceScore.toFixed(2)}  ${s.title}`);
    console.log(`  ${s.kind} · ${s.eventIds.length} event(s) · last ${s.lastActivityAt}`);
  }
}

export function cmdSessionsGet(workspace: string, id: string): void {
  const session = readSession(workspace, id);
  if (!session) {
    console.error(`Not found: ${id}`);
    process.exitCode = 1;
    return;
  }
  const events = readNormalizedEvents(workspace).filter((e) => session.eventIds.includes(e.id));
  console.log(JSON.stringify({ session, events }, null, 2));
}

export function cmdSessionsStudy(workspace: string, id: string): void {
  const result = studySession(workspace, id, nowIso());
  console.log(JSON.stringify(result, null, 2));
}
