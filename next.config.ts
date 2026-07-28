import type { NextConfig } from "next";

// Hardened CSP for production. Interactive artifacts run in their own
// `<iframe srcdoc sandbox="allow-scripts">`, isolated from this policy.
// Skipped in development so Next's HMR (eval + websockets) works.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-src 'self'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // The Agent SDK spawns a CLI / uses native modules — don't bundle it.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "@anthropic-ai/sdk"],
  devIndicators: false,
  // Ensure the committed KB + page images ship with the server bundle
  // (the chat route reads them from disk at runtime).
  outputFileTracingIncludes: {
    "/api/chat": ["./data/**/*", "./public/manual/**/*"],
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
    ];
  },
};

export default nextConfig;
