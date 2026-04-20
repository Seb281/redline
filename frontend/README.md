# Redline — Frontend

Next.js app handling UI, streaming LLM analysis pipeline, clause chat, and interactive report rendering.

See the [root README](../README.md) for architecture and pipeline details.

## Setup

```bash
pnpm install
cp .env.example .env.local   # add your MISTRAL_API_KEY
pnpm dev                     # http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint (flat config) |
| `pnpm test` | Run tests (vitest) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MISTRAL_API_KEY` | Yes | Mistral La Plateforme API key — the sole LLM provider (Paris, EU) |
| `NEXT_PUBLIC_API_URL` | No | Backend URL (default: `http://localhost:8001`) |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | No | Contact email shown on privacy page (default: `privacy@example.com`) |
