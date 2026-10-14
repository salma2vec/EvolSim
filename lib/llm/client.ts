/** Explicit provider calls. Missing credentials or failures never become synthetic decisions. */
import OpenAI from "openai";

export async function callLLM(modelId: string, prompt: string,
  options?: { temperature?: number; maxTokens?: number; seed?: number; schema?: Record<string, unknown> }): Promise<string> {
  if (process.env.EVOLSIM_ENABLE_LLM !== "true") throw new Error("Live LLM calls disabled");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");
  const allowed = (process.env.EVOLSIM_MODELS || "").split(",").map(x => x.trim()).filter(Boolean);
  if (!allowed.includes(modelId)) throw new Error("Model is not in EVOLSIM_MODELS allowlist");
  if (!prompt || prompt.length > 50000) throw new Error("Invalid prompt length");
  const maxTokens = options?.maxTokens ?? 1000;
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 2000) throw new Error("Invalid token limit");
  const tokenField = process.env.EVOLSIM_TOKEN_LIMIT_FIELD ?? "max_completion_tokens";
  if (tokenField !== "max_tokens" && tokenField !== "max_completion_tokens") throw new Error("Invalid token limit field");
  const openai = new OpenAI({ apiKey, timeout: 30000, maxRetries: 0 });
  const response = await openai.chat.completions.create({
    model: modelId,
    messages: [
      { role: "system", content: "You are a strategic decision-making system for an alien species. Always respond with valid JSON only." },
      { role: "user", content: prompt },
    ],
    ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options?.seed !== undefined ? { seed: options.seed } : {}),
    ...(options?.schema ? { response_format: { type: "json_schema" as const,
      json_schema: { name: "species_decision", strict: true, schema: options.schema } } } : {}),
    [tokenField]: maxTokens,
  });
  const content = response.choices[0]?.message?.content;
  if (!content || response.choices[0].finish_reason !== "stop") throw new Error("Provider returned incomplete output");
  return content;
}
