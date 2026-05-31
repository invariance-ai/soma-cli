import type { EntityMention, EntityRef } from "../types.js";

const TICKET_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
const EMAIL_RE = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
const SLACK_MENTION_RE = /<@([A-Z0-9]+)>|@([A-Za-z][A-Za-z0-9._-]+)/g;
const SERVICE_RE = /\b(payments?|checkout|auth|billing|search|platform|infra)\b/gi;

function ref(kind: EntityRef["kind"], id: string, label: string): EntityRef {
  return { kind, id, label };
}

function pushUnique(out: EntityMention[], mention: EntityMention): void {
  if (out.some((m) => m.entity.id === mention.entity.id && m.match === mention.match)) return;
  out.push(mention);
}

export function extractMentions(text: string): EntityMention[] {
  const out: EntityMention[] = [];

  for (const m of text.matchAll(TICKET_RE)) {
    const key = m[1].toUpperCase();
    pushUnique(out, {
      entity: ref("ticket", `ticket:${key}`, key),
      match: m[0],
      confidence: 0.95,
    });
  }

  for (const m of text.matchAll(EMAIL_RE)) {
    const email = m[1].toLowerCase();
    pushUnique(out, {
      entity: ref("person", `person:${email}`, email),
      match: m[0],
      confidence: 0.9,
    });
  }

  for (const m of text.matchAll(SLACK_MENTION_RE)) {
    const raw = (m[1] ?? m[2]).trim();
    const id = m[1] ? `person:slack:${raw}` : `person:${raw.toLowerCase()}`;
    pushUnique(out, {
      entity: ref("person", id, raw),
      match: m[0],
      confidence: m[1] ? 0.95 : 0.75,
    });
  }

  for (const m of text.matchAll(SERVICE_RE)) {
    const service = m[1].toLowerCase().replace(/s$/, "");
    pushUnique(out, {
      entity: ref("service", `service:${service}`, service),
      match: m[0],
      confidence: 0.65,
    });
  }

  return out;
}

export function entityFromEmail(email: string): EntityRef {
  return ref("person", `person:${email.toLowerCase()}`, email.toLowerCase());
}

export function entityFromSlackUser(userId: string): EntityRef {
  return ref("person", `person:slack:${userId}`, userId);
}

export function entityFromLinearUser(user: string): EntityRef {
  const normalized = user.includes("@") ? user.toLowerCase() : user;
  return ref("person", `person:${normalized}`, normalized);
}
