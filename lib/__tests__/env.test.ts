import { describe, it, expect, afterEach } from "vitest";
import { readEnv } from "../env";

describe("readEnv", () => {
  afterEach(() => {
    delete process.env.AGENT_MODEL;
  });

  it("throws a helpful error when the key is missing", () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => readEnv()).toThrow(/ANTHROPIC_API_KEY is not set/);
    if (saved) process.env.ANTHROPIC_API_KEY = saved;
  });

  it("defaults the model to claude-opus-4-8", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    expect(readEnv().model).toBe("claude-opus-4-8");
  });

  it("honors an AGENT_MODEL override", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    process.env.AGENT_MODEL = "claude-sonnet-5";
    expect(readEnv().model).toBe("claude-sonnet-5");
  });
});
