import { describe, it, expect } from "vitest";
import { decideWrite } from "../src/agent-core/index.js";

describe("write policies", () => {
  it("rejects human_locked", () => {
    expect(decideWrite("human_locked").action).toBe("reject");
  });
  it("proposes human_approved without authorization", () => {
    expect(decideWrite("human_approved").action).toBe("propose");
  });
  it("applies human_approved with explicit authorization", () => {
    expect(decideWrite("human_approved", { explicitlyAuthorized: true }).action).toBe("apply");
  });
  it("applies agent_editable", () => {
    expect(decideWrite("agent_editable").action).toBe("apply");
  });
  it("appends append_only", () => {
    expect(decideWrite("append_only").action).toBe("append");
  });
});
