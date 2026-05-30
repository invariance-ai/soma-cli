import { searchMemory, readMemory } from "../../agent-core/index.js";

export function cmdMemorySearch(workspace: string, query: string, opts: { limit?: string }): void {
  const limit = opts.limit ? parseInt(opts.limit, 10) : 8;
  const hits = searchMemory(workspace, query, limit);
  if (hits.length === 0) {
    console.log(`No memory matched "${query}".`);
    return;
  }
  console.log(`${hits.length} hit(s) for "${query}":\n`);
  for (const h of hits) {
    const heading = h.matchedHeading ? ` › ${h.matchedHeading}` : "";
    console.log(`  [${h.score.toFixed(0)}] ${h.file.relPath}${heading}`);
    console.log(`        ${h.snippet}`);
  }
}

export function cmdMemoryRead(workspace: string, relPath: string): void {
  const file = readMemory(workspace, relPath);
  if (!file) {
    console.error(`Not found: ${relPath}`);
    process.exitCode = 1;
    return;
  }
  console.log(`# ${file.title}  (${file.relPath})`);
  console.log(`policy: ${file.meta.write_policy} | type: ${file.meta.type} | id: ${file.id}`);
  console.log("");
  console.log(file.body);
}
