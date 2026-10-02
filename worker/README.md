---
noteId: "b26277d0be1e11f188fc854e24022fc7"
tags: []

---

# Portfolio Chat Worker

This Cloudflare Worker powers `ask.html`. It accepts questions only from the configured portfolio origin, rate-limits requests, and sends the approved portfolio knowledge base to Gemini. Accepted questions and their replies (or failures) are saved in Cloudflare D1 and shown in the private `/admin/` dashboard.

## Conversation dashboard

- Open the Worker URL ending in `/admin/`, not the GitHub Pages URL.
- Sign in using `CHAT_ADMIN_PASSWORD`. Use a unique, randomly generated password of at least 10 characters, kept in a password manager. The password is a Worker secret, never part of the public site or Git history.
- Browse visits, search questions and replies, select a visit to read the exchange, and refresh for new activity. Long lists and transcripts have load-more controls.
- An anonymous visit ID is saved in browser session storage. It survives page refreshes but is not a visitor identity; an older tab without the ID creates a separate visit per question. Past conversations cannot be recovered.
- No visitor names, emails, or IP addresses are saved in the transcript database. IPs are used only by the existing request rate limiter.
- Messages older than 30 days are excluded from dashboard queries immediately. An hourly scheduled job removes expired rows; physical deletion can lag the cutoff by up to an hour. Cloudflare's database backup/Time Travel retention is separate from active records.
- Sign-in attempts are rate-limited. Owner sessions expire after eight hours, use signed HttpOnly, SameSite cookies (Secure in production), and are not saved in browser local storage. Signing out clears the browser cookie; changing the Worker password invalidates all signed sessions.
- The dashboard and its API use `no-store` caching, no-index headers, a content security policy, and plain-text rendering of visitor messages. Public visitors cannot read transcripts, even if they know a visit ID. The login page itself is public.

## Local setup

1. Run `npm install` in this folder.
2. Copy `.dev.vars.example` to `.dev.vars`.
3. Set `GEMINI_API_KEY` and a unique `CHAT_ADMIN_PASSWORD` of at least 10 characters. Do not commit `.dev.vars`.
4. Run `npm run db:local` to apply the schema to the local database.
5. Run `npm run dev`. Open the printed local Worker URL ending in `/admin/`.
6. Serve the portfolio locally at `http://127.0.0.1:4173`, then set `window.PORTFOLIO_CHAT_ENDPOINT` in `../chat-config.js` to the local Worker URL ending in `/ask`. Restore the production endpoint before publishing.

`database_id` in `wrangler.jsonc` now references the real `khanh-portfolio-conversations` database in this portfolio's Cloudflare account. Local development still uses a separate local database. For another account, create its own database and update the ID; never use an all-zero placeholder for deployment.

## Verification

- `npm run check` checks Worker and dashboard JavaScript syntax; run `node --check ../ask.js` for the visitor script.
- `npm test` exercises the Worker against in-memory SQLite using Node.js 24. Tests cover authentication, cookie expiry/tampering, origins, throttling, stored transcripts and failed replies, search, pagination, retention, and unavailable storage. Gemini is mocked; tests do not call a paid API or production data.
- Apply migrations locally and verify `/admin/` in the browser before deployment. Preview fixtures must be marked synthetic and kept in ignored `.wrangler/` state.

## Deploy

Run these steps from `worker/` after approval to enable logging on the live site:

1. Authenticate with Cloudflare using `npx wrangler login`.
2. This account's `khanh-portfolio-conversations` database is already created and bound to `CHAT_DB` in `wrangler.jsonc`. For a different account, create the database with `npx wrangler d1 create khanh-portfolio-conversations` and use the returned ID. Keep the `CHAT_DB` binding.
3. Apply the additive schema using `npx wrangler d1 migrations apply CHAT_DB --remote`. Never point this migration at an unrelated existing database.
4. Set the owner password with `npx wrangler secret put CHAT_ADMIN_PASSWORD`. Enter it at the prompt; do not paste it into chat, public code, or a command argument. Keep the existing Gemini secret; set `GEMINI_API_KEY` only if it has not already been configured.
5. Publish the changed GitHub Pages files (`ask.html` and `ask.js`) and verify the live page shows the saved-conversation notice **before** deploying the logging Worker. This prevents collecting conversations without the disclosure. Keep the existing production `/ask` endpoint in `chat-config.js`.
6. Confirm `ALLOWED_ORIGINS` matches the live portfolio URL, then run `npm run deploy`.
7. Open `https://khanh-portfolio-chat.thuykhanh2642.workers.dev/admin/`, sign in, ask a non-private test question from the live site, and confirm its reply appears. Confirm `/admin/api/conversations` returns 401 without an owner cookie.

As of October 2, 2026, the visitor notice and visit IDs are published, the real database is bound and migrated, and the Worker is deployed with its hourly cleanup schedule. Live logging was verified with two non-private deployment test questions and replies grouped into one visit. At the user's request, the owner password minimum is now 10 characters; secret existence alone is insufficient. Verify `/admin/api/session` returns 401 without an owner cookie and sign in at the live dashboard. Keep deployment test records unless deletion is explicitly approved.

`GEMINI_MODEL` defaults to the free-tier `gemini-3.1-flash-lite`; update it in `wrangler.jsonc` if you want to use a different Gemini model.

Gemini's free tier may use submitted data to improve Google products. The Ask page tells visitors not to include private information.

Implementation references checked on **October 2, 2026**: [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [Worker asset bindings](https://developers.cloudflare.com/workers/static-assets/binding/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), and [Gemini generateContent](https://ai.google.dev/api/generate-content). `store: false` is preserved for Gemini request logging; it does not disable this site's own D1 transcript storage or change Google's separate data-use terms.
