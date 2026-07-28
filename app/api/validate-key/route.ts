import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Validates an Anthropic API key with a cheap, token-free call (models list).
 * Never stores or logs the key.
 */
export async function POST(req: Request) {
  let key: string | undefined;
  try {
    key = ((await req.json()) as { key?: string }).key?.trim();
  } catch {
    /* fall through */
  }

  if (!key) {
    return Response.json({ valid: false, error: "Enter your API key." });
  }
  if (!/^sk-ant-/.test(key)) {
    return Response.json({
      valid: false,
      error: "Anthropic keys start with “sk-ant-”. Check you pasted the whole key.",
    });
  }

  try {
    const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: 15000 });
    await client.models.list();
    return Response.json({ valid: true });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403) {
      return Response.json({
        valid: false,
        error: "That key was rejected. Double-check it and try again.",
      });
    }
    return Response.json({
      valid: false,
      error: "Couldn’t verify the key just now. Check your connection and retry.",
    });
  }
}
