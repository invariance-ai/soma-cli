import { initSoma } from "../../agent-core/index.js";
import { nowIso } from "../clock.js";

export function cmdInit(workspace: string, opts: { force?: boolean }): void {
  const res = initSoma(workspace, nowIso(), { force: opts.force });
  if (res.alreadyExisted && res.created.length === 0) {
    console.log(`.soma/ already initialized at ${res.root} (nothing to do).`);
  } else {
    console.log(`Initialized .soma/ at ${res.root}`);
    console.log(`  created: ${res.created.length} file(s)`);
    if (res.skipped.length) console.log(`  skipped (exists): ${res.skipped.length}`);
  }
}
