# Vulcan OmniPro 220 Assistant — container image for any Node host
# (Railway, Render, Fly.io, or self-host). The Claude Agent SDK ships a large
# native CLI binary and spawns it as a subprocess, so it needs a real Node
# runtime with full node_modules — not a size-capped serverless function.
FROM node:22-slim

WORKDIR /app

# Install deps first (better layer caching). npm ci pulls the platform-matched
# @anthropic-ai/claude-agent-sdk-linux-* binary automatically.
COPY package.json package-lock.json ./
RUN npm ci

# Build the app (KB + page images are committed, so no extraction needed).
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# For a public BYOK demo, do NOT set ANTHROPIC_API_KEY — visitors bring their
# own key. To run on a server key instead, pass -e ANTHROPIC_API_KEY=... .
CMD ["npm", "run", "start"]
