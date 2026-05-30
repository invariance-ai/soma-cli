import fs from "node:fs";
import path from "node:path";
import { somaPaths } from "../paths.js";
import { defaultTemplates } from "./templates.js";

export interface InitResult {
  root: string;
  created: string[];
  skipped: string[];
  alreadyExisted: boolean;
}

/**
 * Scaffold a `.soma/` runtime in `workspace`. Idempotent: existing files are
 * left untouched and reported under `skipped`.
 */
export function initSoma(
  workspace: string,
  now: string,
  opts: { force?: boolean } = {},
): InitResult {
  const paths = somaPaths(workspace);
  const alreadyExisted = fs.existsSync(paths.root);

  for (const dir of [paths.root, paths.agent, paths.memory, paths.facts, paths.runs]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.mkdirSync(path.join(paths.memory, "projects"), { recursive: true });
  fs.mkdirSync(path.join(paths.memory, "people"), { recursive: true });
  fs.mkdirSync(path.join(paths.memory, "histories"), { recursive: true });

  const created: string[] = [];
  const skipped: string[] = [];

  for (const tmpl of defaultTemplates(now)) {
    const abs = path.join(paths.root, tmpl.relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (fs.existsSync(abs) && !opts.force) {
      skipped.push(tmpl.relPath);
      continue;
    }
    fs.writeFileSync(abs, tmpl.content, "utf8");
    created.push(tmpl.relPath);
  }

  // Ensure an empty facts log exists.
  if (!fs.existsSync(paths.factsFile)) {
    fs.writeFileSync(paths.factsFile, "", "utf8");
    created.push("facts/facts.jsonl");
  } else {
    skipped.push("facts/facts.jsonl");
  }

  return { root: paths.root, created, skipped, alreadyExisted };
}
