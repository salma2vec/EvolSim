/**
 * LLM client wrapper for OpenAI API with fallback mocks
 */

const MODEL_PROFILES: Record<string, { model: string; temperature: number; maxTokens: number }> = {
  small: { model: "gpt-3.5-turbo", temperature: 0.7, maxTokens: 500 },
  medium: { model: "gpt-4", temperature: 0.7, maxTokens: 800 },
  frontier: { model: "gpt-4-turbo-preview", temperature: 0.7, maxTokens: 1000 },
  frontier_reasoning: { model: "gpt-4-turbo-preview", temperature: 0.5, maxTokens: 2000 },
};

/**
 * Generate a mock response for testing
 */
function generateMockResponse(modelId: string): string {
  // Deterministic mock based on modelId
  const baseHarvest = modelId.includes("small") ? 30 : modelId.includes("medium") ? 25 : 20;
  
  return JSON.stringify({
    harvest: {
      fish_oceans: baseHarvest,
      atmospheric_carbon: baseHarvest * 0.8,
      mineral_deposits: baseHarvest * 0.6,
      energy_flux: baseHarvest * 0.7,
    },
    relations: {},
    governance: {
      punishment_strength: 0.4,
      monitoring_investment: 0.3,
    },
    treatyProposals: [],
  });
}

/**
 * Call LLM via OpenAI API
 */
export async function callLLM(
  modelId: string,
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not set, using mock response");
    return generateMockResponse(modelId);
  }
  
  const profile = MODEL_PROFILES[modelId] || MODEL_PROFILES.small;
  const model = profile.model;
  const temperature = options?.temperature ?? profile.temperature;
  const maxTokens = options?.maxTokens ?? profile.maxTokens;
  
  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You are a strategic decision-making system for an alien species. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature,
      max_tokens: maxTokens,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in response");
    }
    
    return content;
  } catch (error) {
    console.error("LLM API error:", error);
    console.warn("Falling back to mock response");
    return generateMockResponse(modelId);
  }
}

