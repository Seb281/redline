# Redline — Frontend

Next.js app handling UI, LLM analysis pipeline, and interactive report rendering.

See the [root README](../README.md) for architecture and pipeline details.

## Setup

```bash
pnpm install
cp .env.example .env.local   # add your OPENAI_API_KEY
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
| `OPENAI_API_KEY` | Yes | OpenAI API key for contract analysis |
| `NEXT_PUBLIC_API_URL` | No | Backend URL (default: `http://localhost:8001`) |
