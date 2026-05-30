import fs from "node:fs";
import { somaPaths } from "../paths.js";
import type { Fact } from "../types.js";
import { FactSchema } from "./fact-schema.js";

/** Append a validated fact to facts.jsonl. Throws on schema violation. */
export function appendFact(workspace: string, fact: Fact): Fact {
  const validated = FactSchema.parse(fact);
  const { factsFile, facts } = somaPaths(workspace);
  fs.mkdirSync(facts, { recursive: true });
  fs.appendFileSync(factsFile, JSON.stringify(validated) + "\n", "utf8");
  return validated;
}

/** Read all facts, skipping malformed lines. */
export function readFacts(workspace: string): Fact[] {
  const { factsFile } = somaPaths(workspace);
  if (!fs.existsSync(factsFile)) return [];
  const out: Fact[] = [];
  for (const line of fs.readFileSync(factsFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = FactSchema.safeParse(JSON.parse(trimmed));
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
