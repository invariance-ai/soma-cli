import { spawn } from "node:child_process";
import type { CompiledPromptPack, ModelProvider, ModelResult } from "../types.js";
import { resolveCitations } from "./citations.js";

export interface ClaudeCliOptions {
  /** Binary to invoke; default "claude". */
  bin?: string;
  /** Model flag passed to `claude -p`. */
  model?: string;
  timeoutMs?: number;
}

function runClaude(prompt: string, systemPrompt: string, opts: ClaudeCliOptions): Promise<string> {
  const bin = opts.bin ?? "claude";
  const args = ["-p", "--append-system-prompt", systemPrompt];
  if (opts.model) args.push("--model", opts.model);

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`claude CLI timed out after ${opts.timeoutMs ?? 120000}ms`));
    }, opts.timeoutMs ?? 120000);

    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude CLI exited ${code}: ${err.trim() || out.trim()}`));
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/**
 * Model provider backed by the local `claude -p` CLI (credit-free path; the
 * Anthropic API key is out of credits). Same ModelProvider interface as any
 * other adapter.
 */
export function claudeCliProvider(opts: ClaudeCliOptions = {}): ModelProvider {
  return {
    name: "claude-cli",
    async complete(input: CompiledPromptPack): Promise<ModelResult> {
      const text = await runClaude(input.userPrompt, input.systemPrompt, opts);
      return {
        text,
        provider: "claude-cli",
        citations: resolveCitations(text, input.pack),
        meta: { model: opts.model ?? "default" },
      };
    },
  };
}

/** Whether the claude CLI is available on PATH. */
export function claudeCliAvailable(bin = "claude"): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(bin, ["--version"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}
