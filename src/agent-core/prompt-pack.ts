import fs from "node:fs";
import path from "node:path";
import { somaPaths, AGENT_FILES } from "./paths.js";
import { parseMemory } from "./memory/frontmatter.js";
import { searchMemory } from "./memory/memory-store.js";
import { classify } from "./classify.js";
import { toolsForKind } from "./tools/tool-registry.js";
import { profileForKind, DEFAULT_BUDGET, DEFAULT_POLICIES } from "./profiles/defaults.js";
import type {
  CompiledPromptPack,
  MemoryBlock,
  PromptPack,
  UserTask,
} from "./types.js";

/** Rough token estimate: ~4 chars/token. */
export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

function blockFrom(
  source: "always" | "retrieved",
  relPath: string,
  title: string,
  content: string,
): MemoryBlock {
  return { id: `${source}:${relPath}`, source, relPath, title, content, tokens: estimateTokens(content) };
}

/** Load always-on identity blocks from `.soma/agent`. */
function loadAlwaysBlocks(workspace: string): MemoryBlock[] {
  const { agent } = somaPaths(workspace);
  const blocks: MemoryBlock[] = [];
  for (const file of AGENT_FILES) {
    const abs = path.join(agent, file);
    if (!fs.existsSync(abs)) continue;
    const { body } = parseMemory(fs.readFileSync(abs, "utf8"), `agent/${file}`);
    const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? file;
    blocks.push(blockFrom("always", `agent/${file}`, title, body));
  }
  return blocks;
}

/** Apply the token budget to retrieved blocks, returning kept + trimmed. */
function applyBudget(
  retrieved: MemoryBlock[],
  alreadyUsed: number,
  maxTokens: number,
): { kept: MemoryBlock[]; trimmed: MemoryBlock[] } {
  const kept: MemoryBlock[] = [];
  const trimmed: MemoryBlock[] = [];
  let used = alreadyUsed;
  for (const block of retrieved) {
    if (used + block.tokens <= maxTokens) {
      kept.push(block);
      used += block.tokens;
    } else {
      trimmed.push(block);
    }
  }
  return { kept, trimmed };
}

/** Compile a PromptPack for a task: classify, load, retrieve, budget, scope tools. */
export function compilePromptPack(task: UserTask): PromptPack {
  const classification = classify(task);
  const profile = profileForKind(classification.kind);
  const tools = toolsForKind(classification.kind);

  const always = loadAlwaysBlocks(task.workspace);
  // system = the locked system file; the rest are alwaysMemory identity blocks.
  const system = always.filter((b) => b.relPath === "agent/system.md");
  const alwaysMemory = always.filter((b) => b.relPath !== "agent/system.md");

  const hits = searchMemory(task.workspace, task.input, 8);
  const retrievedAll = hits.map((h) =>
    blockFrom("retrieved", h.file.relPath, h.file.title, h.file.body),
  );

  const usedByAlways = always.reduce((n, b) => n + b.tokens, 0);
  const { kept, trimmed } = applyBudget(retrievedAll, usedByAlways, DEFAULT_BUDGET.maxTokens);

  return {
    profile,
    system,
    alwaysMemory,
    retrievedMemory: kept,
    tools,
    task,
    classification,
    budget: DEFAULT_BUDGET,
    policies: DEFAULT_POLICIES,
    trimmed,
  };
}

/** Flatten a PromptPack into provider-ready system/user prompts. */
export function renderPromptPack(pack: PromptPack): CompiledPromptPack {
  const systemParts: string[] = [];
  for (const b of pack.system) systemParts.push(b.content);
  for (const b of pack.alwaysMemory) systemParts.push(`# ${b.title}\n\n${b.content}`);

  const memoryParts: string[] = [];
  for (const b of pack.retrievedMemory) {
    memoryParts.push(`<memory path="${b.relPath}">\n${b.content}\n</memory>`);
  }

  const toolList = pack.tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");

  const systemPrompt = systemParts.join("\n\n---\n\n");
  const userPrompt = [
    memoryParts.length ? `Relevant memory:\n\n${memoryParts.join("\n\n")}` : "No memory matched this query.",
    `Available tools:\n${toolList}`,
    `Task (${pack.classification.kind}): ${pack.task.input}`,
    `Answer concisely and cite the memory paths you used.`,
  ].join("\n\n");

  const loadedBlocks = [...pack.system, ...pack.alwaysMemory, ...pack.retrievedMemory];
  const loadedBlockIds = loadedBlocks.map((b) => b.id);
  const totalTokens = loadedBlocks.reduce((n, b) => n + b.tokens, 0) + estimateTokens(userPrompt);

  return { pack, systemPrompt, userPrompt, loadedBlockIds, totalTokens };
}

/** Human-readable dry-run rendering of a compiled pack. */
export function renderDryRun(pack: PromptPack): string {
  const lines: string[] = [];
  lines.push(`Profile:        ${pack.profile.id} — ${pack.profile.description}`);
  lines.push(`Classification: ${pack.classification.kind} (${pack.classification.confidence}) — ${pack.classification.reason}`);
  lines.push(`Tools:          ${pack.tools.map((t) => t.name).join(", ") || "(none)"}`);
  lines.push("");
  lines.push("Always-on blocks:");
  for (const b of [...pack.system, ...pack.alwaysMemory]) lines.push(`  - ${b.relPath} (~${b.tokens} tok)`);
  lines.push("");
  lines.push(`Retrieved memory (budget ${pack.budget.maxTokens} tok):`);
  if (pack.retrievedMemory.length === 0) lines.push("  (none matched)");
  for (const b of pack.retrievedMemory) lines.push(`  - ${b.relPath} (~${b.tokens} tok)`);
  if (pack.trimmed.length) {
    lines.push("");
    lines.push("Trimmed (over budget):");
    for (const b of pack.trimmed) lines.push(`  - ${b.relPath} (~${b.tokens} tok)`);
  }
  return lines.join("\n");
}
