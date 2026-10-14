import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { callLLM } from "@/lib/llm/client";

const { create, construct } = vi.hoisted(() => ({ create: vi.fn(), construct: vi.fn() }));
vi.mock("openai", () => ({ default: class {
  constructor(options: unknown) { construct(options); }
  chat = { completions: { create } };
} }));

beforeEach(() => {
  vi.stubEnv("EVOLSIM_ENABLE_LLM", "true");
  vi.stubEnv("EVOLSIM_MODELS", "local-test");
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  vi.stubEnv("EVOLSIM_TOKEN_LIMIT_FIELD", undefined);
  create.mockResolvedValue({ choices: [{ message: { content: '{"harvest":{}}' }, finish_reason: "stop" }] });
});
afterEach(() => vi.unstubAllEnvs());

it("keeps the default token budget and bounded SDK requests", async () => {
  await callLLM("local-test", "Test decision");
  expect(create.mock.calls[0][0]).toMatchObject({ max_completion_tokens: 1000 });
  expect(create.mock.calls[0][0]).not.toHaveProperty("max_tokens");
  expect(construct).toHaveBeenCalledWith({ apiKey: "test-only", timeout: 30000, maxRetries: 0 });
});

it("uses the provider's explicit compatible token field without changing its budget", async () => {
  vi.stubEnv("EVOLSIM_TOKEN_LIMIT_FIELD", "max_tokens");
  await callLLM("local-test", "Test decision", { maxTokens: 128 });
  expect(create.mock.calls[0][0]).toMatchObject({ max_tokens: 128 });
  expect(create.mock.calls[0][0]).not.toHaveProperty("max_completion_tokens");
});

it("rejects unknown token fields before constructing a client", async () => {
  vi.stubEnv("EVOLSIM_TOKEN_LIMIT_FIELD", "unbounded");
  await expect(callLLM("local-test", "Test decision")).rejects.toThrow("Invalid token limit field");
  expect(construct).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});

it("fails on truncated provider output instead of accepting a partial decision", async () => {
  create.mockResolvedValue({ choices: [{ message: { content: '{"harvest":{}' }, finish_reason: "length" }] });
  await expect(callLLM("local-test", "Test decision")).rejects.toThrow("incomplete output");
});
