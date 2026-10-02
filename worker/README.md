---
noteId: "b26277d0be1e11f188fc854e24022fc7"
tags: []

---

# Portfolio Chat Worker

This Cloudflare Worker powers `ask.html`. It accepts questions only from the configured portfolio origin, rate-limits requests, and sends a small approved portfolio knowledge base to the OpenAI Responses API. It does not store conversations.

## Local setup

1. Run `npm install` in this folder.
2. Copy `.dev.vars.example` to `.dev.vars`.
3. Replace `OPENAI_API_KEY` with an API key. Do not commit `.dev.vars`.
4. Run `npm run dev`.
5. Serve the portfolio locally at `http://127.0.0.1:4173`, then set `window.PORTFOLIO_CHAT_ENDPOINT` in `../chat-config.js` to the Worker URL ending in `/ask`.

## Deploy

1. Authenticate with Cloudflare using `npx wrangler login`.
2. Store the API key with `npx wrangler secret put OPENAI_API_KEY`.
3. Run `npm run deploy`.
4. Copy the deployed Worker URL ending in `/ask` into `../chat-config.js`.
5. Confirm `ALLOWED_ORIGINS` in `wrangler.jsonc` is the portfolio's live URL before deploying.

`OPENAI_MODEL` defaults to `gpt-5-mini`; update it in `wrangler.jsonc` if your OpenAI project uses a different model.
