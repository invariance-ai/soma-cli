import fs from "node:fs";
import path from "node:path";
import { somaPaths } from "../paths.js";
import type { MemoryFile, MemoryMeta } from "../types.js";
import { parseMemory, stringifyMemory } from "./frontmatter.js";

/** Recursively list `.md` files under a directory, returning relative paths. */
function listMarkdown(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listMarkdown(abs, base));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(path.relative(base, abs));
    }
  }
  return out.sort();
}

function deriveTitle(body: string, relPath: string): string {
  const h1 = body.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return path.basename(relPath, ".md");
}

function extractHeadings(body: string): string[] {
  const out: string[] = [];
  const re = /^#{2,3}\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.push(m[1].trim());
  return out;
}

function resolveMemoryPath(workspace: string, relPath: string): { abs: string; rel: string } {
  const { memory } = somaPaths(workspace);
  const requested = relPath.endsWith(".md") ? relPath : `${relPath}.md`;
  const abs = path.resolve(memory, requested);
  const root = path.resolve(memory);
  const rel = path.relative(root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`memory path escapes .soma/memory: ${relPath}`);
  }
  return { abs, rel };
}

function toMemoryFile(relPath: string, absPath: string, raw: string): MemoryFile {
  const { meta, body } = parseMemory(raw, relPath);
  return {
    id: meta.soma_id,
    relPath,
    absPath,
    meta,
    body,
    title: deriveTitle(body, relPath),
    headings: extractHeadings(body),
  };
}

/** Read every memory file under `.soma/memory`. */
export function readAllMemory(workspace: string): MemoryFile[] {
  const { memory } = somaPaths(workspace);
  return listMarkdown(memory).map((rel) => {
    const abs = path.join(memory, rel);
    return toMemoryFile(rel, abs, fs.readFileSync(abs, "utf8"));
  });
}

/** Read a single memory file by its path relative to `.soma/memory`. */
export function readMemory(workspace: string, relPath: string): MemoryFile | null {
  const { abs, rel } = resolveMemoryPath(workspace, relPath);
  if (!fs.existsSync(abs)) return null;
  return toMemoryFile(rel, abs, fs.readFileSync(abs, "utf8"));
}

/** Write a memory file (caller is responsible for policy checks). */
export function writeMemory(
  workspace: string,
  relPath: string,
  meta: MemoryMeta,
  body: string,
): void {
  const { abs } = resolveMemoryPath(workspace, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stringifyMemory(meta, body), "utf8");
}

/** Append a dated entry to an append-only memory file. */
export function appendMemoryEntry(
  workspace: string,
  relPath: string,
  entry: string,
  now: string,
): void {
  const file = readMemory(workspace, relPath);
  if (!file) throw new Error(`memory file not found: ${relPath}`);
  const dated = `\n## ${now}\n\n${entry.trim()}\n`;
  writeMemory(workspace, relPath, { ...file.meta, updated_at: now }, file.body + "\n" + dated);
}
