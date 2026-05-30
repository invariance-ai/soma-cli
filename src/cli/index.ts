#!/usr/bin/env node
import { Command } from "commander";
import { cmdInit } from "./commands/init.js";
import { cmdAsk } from "./commands/ask.js";
import { cmdMemorySearch, cmdMemoryRead } from "./commands/memory.js";
import { cmdRemember } from "./commands/remember.js";
import { cmdRunsInspect } from "./commands/runs.js";

const program = new Command();

program
  .name("soma")
  .description("Soma — agentic prompt + memory runtime for engineering work")
  .version("0.0.1")
  .option("-C, --workspace <dir>", "workspace whose .soma/ to use", process.cwd());

function ws(): string {
  return program.opts().workspace as string;
}

program
  .command("init")
  .description("scaffold a .soma/ runtime in the workspace")
  .option("-f, --force", "overwrite existing files")
  .action((opts) => cmdInit(ws(), opts));

program
  .command("ask <question>")
  .description("answer a question grounded in memory, with citations")
  .option("--dry-run", "compile and print the prompt pack without calling a model")
  .option("--model <model>", "model passed to the claude CLI")
  .action((question, opts) => cmdAsk(ws(), question, opts));

program
  .command("remember <statement>")
  .description("record a durable fact or note")
  .option("--authorize", "authorize writing human_approved memory files")
  .action((statement, opts) => cmdRemember(ws(), statement, opts));

const memory = program.command("memory").description("inspect memory");
memory
  .command("search <query>")
  .option("-n, --limit <n>", "max hits", "8")
  .action((query, opts) => cmdMemorySearch(ws(), query, opts));
memory
  .command("read <path>")
  .description("read a memory file by path relative to .soma/memory")
  .action((path) => cmdMemoryRead(ws(), path));

const runs = program.command("runs").description("inspect run traces");
runs
  .command("inspect <which>")
  .description('inspect a run (currently "latest")')
  .action((which) => cmdRunsInspect(ws(), which));

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
