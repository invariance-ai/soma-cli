import type { MemoryFile, MemoryHit } from "../types.js";
import { readAllMemory } from "./markdown-store.js";

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/** Field weights — a query term in the title beats one buried in the body. */
const WEIGHTS = {
  title: 8,
  heading: 4,
  somaId: 3,
  type: 2,
  body: 1,
};

function snippetAround(body: string, term: string): string {
  const idx = body.toLowerCase().indexOf(term);
  if (idx === -1) return body.slice(0, 140).replace(/\s+/g, " ").trim();
  const start = Math.max(0, idx - 60);
  const end = Math.min(body.length, idx + 80);
  return (start > 0 ? "…" : "") + body.slice(start, end).replace(/\s+/g, " ").trim() + (end < body.length ? "…" : "");
}

function scoreFile(file: MemoryFile, terms: string[]): MemoryHit | null {
  const titleTokens = new Set(tokenize(file.title));
  const headingTokens = file.headings.map((h) => ({ heading: h, tokens: new Set(tokenize(h)) }));
  const somaIdTokens = new Set(tokenize(file.id));
  const typeTokens = new Set(tokenize(file.meta.type));
  const bodyLower = file.body.toLowerCase();

  let score = 0;
  let matchedHeading: string | undefined;
  let snippetTerm: string | undefined;

  for (const term of terms) {
    if (titleTokens.has(term)) score += WEIGHTS.title;
    for (const h of headingTokens) {
      if (h.tokens.has(term)) {
        score += WEIGHTS.heading;
        if (!matchedHeading) matchedHeading = h.heading;
      }
    }
    if (somaIdTokens.has(term)) score += WEIGHTS.somaId;
    if (typeTokens.has(term)) score += WEIGHTS.type;

    // Body: count occurrences (capped) so repeated mentions rank higher.
    let count = 0;
    let from = 0;
    while (count < 5) {
      const at = bodyLower.indexOf(term, from);
      if (at === -1) break;
      count++;
      from = at + term.length;
    }
    if (count > 0) {
      score += WEIGHTS.body * count;
      if (!snippetTerm) snippetTerm = term;
    }
  }

  if (score === 0) return null;
  const snippet = snippetAround(file.body, snippetTerm ?? terms[0] ?? "");
  return { file, score, matchedHeading, snippet };
}

/** Ranked search over all memory files. */
export function searchMemory(workspace: string, query: string, limit = 8): MemoryHit[] {
  const terms = [...new Set(tokenize(query))];
  if (terms.length === 0) return [];
  const files = readAllMemory(workspace);
  const hits: MemoryHit[] = [];
  for (const file of files) {
    const hit = scoreFile(file, terms);
    if (hit) hits.push(hit);
  }
  hits.sort((a, b) => b.score - a.score || a.file.relPath.localeCompare(b.file.relPath));
  return hits.slice(0, limit);
}
