#!/usr/bin/env node
import { Command } from "commander";
import { cmdInit } from "./commands/init.js";
import { cmdAsk } from "./commands/ask.js";
import { cmdMemorySearch, cmdMemoryRead } from "./commands/memory.js";
import { cmdRemember } from "./commands/remember.js";
import { cmdRunsInspect } from "./commands/runs.js";
import { cmdIngest } from "./commands/ingest.js";
import { cmdSessionsGet, cmdSessionsList, cmdSessionsStudy } from "./commands/sessions.js";
import {
  cmdFindings,
  cmdTickets,
  cmdConnectors,
  cmdReceipts,
  cmdCodeGraph,
  cmdPeople,
  cmdWho,
} from "./commands/platform.js";

const program = new Command();

program
  .name("soma")
  .description("Soma — agentic prompt + memory runtime for engineering work")
  .version("0.0.1")
  .option("-C, --workspace <dir>", "workspace whose .soma/ to use", process.cwd())
  // Platform flags are also accepted globally (before the subcommand) so e.g.
  // `soma --json findings` works in addition to `soma findings --json`.
  .option("--json", "emit raw JSON instead of human-readable output")
  .option("--workspace-id <id>", "platform workspace id (else $SOMA_WORKSPACE_ID)")
  .option("--backend <url>", "platform backend base URL (else $SOMA_BACKEND_URL)");

function ws(): string {
  return program.opts().workspace as string;
}

/** Merge a command's local platform flags with the global ones (local wins). */
function plat<T extends Record<string, unknown>>(local: T): T & {
  json?: boolean;
  workspaceId?: string;
  backend?: string;
} {
  const g = program.opts();
  return {
    ...local,
    json: (local.json as boolean | undefined) ?? (g.json as boolean | undefined),
    workspaceId: (local.workspaceId as string | undefined) ?? (g.workspaceId as string | undefined),
    backend: (local.backend as string | undefined) ?? (g.backend as string | undefined),
  };
}

/** Options reused by every platform command (so they work after the subcommand). */
function platformFlags(cmd: Command): Command {
  return cmd
    .option("--json", "emit raw JSON instead of human-readable output")
    .option("--workspace-id <id>", "platform workspace id (else $SOMA_WORKSPACE_ID)")
    .option("--backend <url>", "platform backend base URL (else $SOMA_BACKEND_URL)");
}

program
  .command("init")
  .description("scaffold a .soma/ runtime in the workspace")
  .option("-f, --force", "overwrite existing files")
  .action((opts) => cmdInit(ws(), opts));

program
  .command("ask <question>")
  .description("answer a question grounded in memory (or, for people questions, platform activity)")
  .option("--dry-run", "compile and print the prompt pack without calling a model")
  .option("--model <model>", "model passed to the claude CLI")
  .option("--json", "emit raw JSON for people questions")
  .option("--workspace-id <id>", "platform workspace id (else $SOMA_WORKSPACE_ID)")
  .option("--backend <url>", "platform backend base URL (else $SOMA_BACKEND_URL)")
  .action((question, opts) => cmdAsk(ws(), question, plat(opts)));

program
  .command("remember <statement>")
  .description("record a durable fact or note")
  .option("--authorize", "authorize writing human_approved memory files")
  .action((statement, opts) => cmdRemember(ws(), statement, opts));

program
  .command("ingest <file>")
  .description("normalize a source fixture/payload into events and sessions")
  .requiredOption("--source <source>", "source name: slack, granola, email, linear, github, datadog, agent")
  .option("--received-at <iso>", "override received_at timestamp")
  .action((file, opts) => cmdIngest(ws(), file, opts));

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

const sessions = program.command("sessions").description("inspect normalized sessions");
sessions
  .command("list")
  .option("-n, --limit <n>", "max sessions", "12")
  .option("--person <query>", "filter to sessions touching a person id/name")
  .action((opts) => cmdSessionsList(ws(), opts));
sessions
  .command("get <id>")
  .description("print a session with its normalized events")
  .action((id) => cmdSessionsGet(ws(), id));
sessions
  .command("study <id>")
  .description("run deterministic session self-study and write .soma/study/<id>.json")
  .action((id) => cmdSessionsStudy(ws(), id));

// ── Platform surfaces — the same data the dashboard shows ──────────────────
platformFlags(program.command("findings").description("list assembled findings (error clusters)")).action(
  (opts) => cmdFindings(plat(opts)),
);

platformFlags(program.command("tickets").description("list tickets across Linear/GitHub")).action((opts) =>
  cmdTickets(plat(opts)),
);

platformFlags(
  program.command("connectors [source]").description("connector ingestion status (one source, or all)"),
).action((source, opts) => cmdConnectors(source, plat(opts)));

platformFlags(
  program
    .command("code-graph")
    .description("read the code graph (nodes + edges)")
    .option("--repo <repo>", "filter to one repo")
    .option("--node-kind <kind>", "filter nodes by kind (file|function|class|...)"),
).action((opts) => cmdCodeGraph(plat(opts)));

platformFlags(
  program
    .command("people")
    .description("list people with recent activity")
    .option("--since <iso>", "only count activity on/after this time"),
).action((opts) => cmdPeople(plat(opts)));

platformFlags(
  program
    .command("who <person>")
    .description('what a person is doing (deterministic) — e.g. `soma who andy`')
    .option("--since <iso>", "lookback window start")
    .option("-n, --limit <n>", "max timeline events"),
).action((person, opts) => cmdWho(person, plat(opts)));

const data = program.command("data").description("explore raw ingested data");
platformFlags(
  data
    .command("receipts")
    .description("query raw normalized receipts (events)")
    .option("--source <source>", "filter by source")
    .option("--kind <kind>", "filter by event kind")
    .option("--since <iso>", "only receipts on/after this time")
    .option("-n, --limit <n>", "max rows", "100"),
).action((opts) => cmdReceipts(plat(opts)));

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
