export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tells the client whether the server already has an API key (local dev with
 * .env) or whether the visitor must supply their own (public BYOK deploy).
 * Never returns the key itself.
 */
export function GET() {
  return Response.json({
    hasServerKey: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  });
}
