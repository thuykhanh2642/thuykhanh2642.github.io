---
noteId: "b26277d0be1e11f188fc854e24022fc7"
tags: []

---

# Portfolio Chat Worker

This Cloudflare Worker powers `ask.html`. It accepts questions only from the configured portfolio origin, rate-limits requests, and sends a small approved portfolio knowledge base to the Gemini API. It does not store conversations.

## Local setup

1. Run `npm install` in this folder.
2. Copy `.dev.vars.example` to `.dev.vars`.
3. Replace `GEMINI_API_KEY` with a Gemini API key from Google AI Studio. Do not commit `.dev.vars`.
4. Run `npm run dev`.
5. Serve the portfolio locally at `http://127.0.0.1:4173`, then set `window.PORTFOLIO_CHAT_ENDPOINT` in `../chat-config.js` to the Worker URL ending in `/ask`.

## Deploy

1. Authenticate with Cloudflare using `npx wrangler login`.
2. Store the API key with `npx wrangler secret put GEMINI_API_KEY`.
3. Run `npm run deploy`.
4. Copy the deployed Worker URL ending in `/ask` into `../chat-config.js`.
5. Confirm `ALLOWED_ORIGINS` in `wrangler.jsonc` is the portfolio's live URL before deploying.

`GEMINI_MODEL` defaults to the free-tier `gemini-3.1-flash-lite`; update it in `wrangler.jsonc` if you want to use a different Gemini model.

Gemini's free tier may use submitted data to improve Google products. The Ask page tells visitors not to include private information.
