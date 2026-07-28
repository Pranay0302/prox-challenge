export interface AppEnv {
  anthropicApiKey: string;
  model: string;
  elevenLabsApiKey?: string;
}

/**
 * Reads and validates server-side environment configuration.
 * Throws a clear, actionable error when the one required key is missing.
 */
export function readEnv(): AppEnv {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.",
    );
  }
  return {
    anthropicApiKey,
    model: process.env.AGENT_MODEL || "claude-opus-4-8",
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || undefined,
  };
}
