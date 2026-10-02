---
noteId: "8cb3eb50be1811f188fc854e24022fc7"
tags: []

---

# Portfolio Continuity

- The portfolio defaults to dark mode; the header toggle persists a visitor's light-mode preference in local storage.
- The visual direction is "Field Notes": forest-ink surfaces, warm paper text, moss actions, and a small ember tint only in the home hero.
- Typography uses DM Serif Display for display headings and DM Sans for navigation, body copy, and technical detail.
- Fine-pointer users receive one subtle moss cursor wash across the site. The homepage XFC capture additionally tilts and receives a soft glint; touch and reduced-motion users receive static visuals.
- Keep project claims grounded in supplied evidence and prefer real project screenshots, gameplay, or artifacts over decorative visual filler.
- `ask.html` is a transparent AI portfolio guide, not an impersonation of Khanh. It sends questions only to the separately deployed `worker/` Cloudflare Worker.
- The Worker uses the approved facts in `worker/src/knowledge.js`, restricts browser origins, rate-limits requests, and keeps the Gemini API key out of GitHub Pages. `chat-config.js` points to `https://khanh-portfolio-chat.thuykhanh2642.workers.dev/ask`.
- Conversation logging and a private owner dashboard are implemented locally in `worker/`. `CHAT_DB` stores accepted questions, replies/failures, anonymous visit IDs, and timestamps; no visitor IPs or identities are persisted. Visits are grouped with a browser-session UUID. Messages expire from dashboard queries after 30 days and are removed by an hourly Worker schedule.
- The dashboard is served at the Worker URL ending in `/admin/`, uses a `CHAT_ADMIN_PASSWORD` secret (at least 16 characters, lowered from 32 at the user's explicit request), signed eight-hour HttpOnly/SameSite cookies, and owner-only read endpoints. The public Ask page discloses transcript storage. Preserve Gemini `store: false` for provider-side request logging.
- On October 2, 2026, created the dedicated `khanh-portfolio-conversations` D1 database (`cf3e7107-c1d7-45b1-91e6-2957b58d5970`), replaced the placeholder `CHAT_DB` ID, and applied migration `0001_chat_turns.sql`. Cloudflare authentication is working.
- The user explicitly approved GitHub Pages publication and Worker deployment with 30-day logging. Published the visitor notice and visit IDs to `main` in commit `57efe31`, verified both live, then deployed the Worker with its hourly retention schedule. Current version `8388d3ee-f466-42f6-9357-fe2f9ea5cf10` lowers the owner password minimum to 16 characters. Logging is LIVE: two non-private browser questions prefixed "Deployment test:" and their Gemini replies were verified in D1 under one visit. Keep these recognizable test records unless the user authorizes deletion.
- The user explicitly approved lowering the owner password minimum to 16 characters on October 2, 2026. Deployed the change; all 12 tests passed, including 16-character login and rejection at 15. The existing login rate limiter and signed cookies remain. Live endpoints still return 503 with the new 16-character setup message, confirming the saved secret is below the new minimum. The user must set a password of at least 16 characters securely; never request or read the secret. Setup instructions are in `worker/README.md`.
