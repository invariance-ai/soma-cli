import type { Citation, PromptPack } from "../types.js";

/** Build citations from the memory blocks a pack loaded. */
export function citationsFromPack(pack: PromptPack): Citation[] {
  return [...pack.alwaysMemory, ...pack.retrievedMemory].map((b) => ({
    ref: `memory:${b.relPath.replace(/\.md$/, "")}`,
    relPath: b.relPath,
    label: b.title,
  }));
}

/**
 * Given model output text and the pack, keep only citations whose file path or
 * title is actually referenced in the answer. Falls back to retrieved-memory
 * citations when the model cited nothing explicitly.
 */
export function resolveCitations(text: string, pack: PromptPack): Citation[] {
  const all = citationsFromPack(pack);
  const lower = text.toLowerCase();
  const referenced = all.filter(
    (c) =>
      (c.relPath && lower.includes(c.relPath.toLowerCase())) ||
      lower.includes(c.label.toLowerCase()),
  );
  if (referenced.length) return referenced;
  return pack.retrievedMemory.map((b) => ({
    ref: `memory:${b.relPath.replace(/\.md$/, "")}`,
    relPath: b.relPath,
    label: b.title,
  }));
}
