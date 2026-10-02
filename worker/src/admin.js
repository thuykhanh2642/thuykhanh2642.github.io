import { RETENTION_DAYS, retentionCutoff, UUID_PATTERN } from "./conversations.js";
import { readJson } from "./request.js";

const SESSION_SECONDS = 8 * 60 * 60;
const COOKIE_NAME = "portfolio_admin";
const encoder = new TextEncoder();
const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { ...SECURITY_HEADERS, ...headers } });
}

function cookie(value, maxAge, url) {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=${maxAge}${secure}`;
}

function configured(env) {
  return typeof env.CHAT_ADMIN_PASSWORD === "string" && env.CHAT_ADMIN_PASSWORD.length >= 32;
}

async function signingKey(password) {
  return crypto.subtle.importKey("raw", encoder.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function createSession(password) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${expires}.${crypto.randomUUID()}`;
  const signature = await crypto.subtle.sign("HMAC", await signingKey(password), encoder.encode(payload));
  const encoded = btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${payload}.${encoded}`;
}

async function authenticated(request, password) {
  const token = (request.headers.get("Cookie") || "").split(";")
    .map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1) || "";
  const match = /^(\d{10})\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match || !UUID_PATTERN.test(match[2])) return false;
  const expires = Number(match[1]);
  const now = Math.floor(Date.now() / 1000);
  if (expires <= now || expires > now + SESSION_SECONDS) return false;
  const bytes = Uint8Array.from(atob(match[3].replaceAll("-", "+").replaceAll("_", "/") + "="), (char) => char.charCodeAt(0));
  return crypto.subtle.verify("HMAC", await signingKey(password), bytes, encoder.encode(`${match[1]}.${match[2]}`));
}

async function samePassword(supplied, expected) {
  // Compare fixed-length digests, not a variable-length password prefix.
  const left = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(supplied)));
  const right = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(expected)));
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function offsetFrom(url) {
  const raw = url.searchParams.get("offset") || "0";
  if (!/^\d{1,7}$/.test(raw)) return null;
  const offset = Number(raw);
  return offset <= 1000000 ? offset : null;
}

async function api(request, env, url) {
  if (!configured(env)) return json({ error: "Owner sign-in needs a dashboard password of at least 32 characters." }, 503);
  if (request.method === "POST" && request.headers.get("Origin") !== url.origin) {
    return json({ error: "Open this dashboard directly to sign in." }, 403);
  }

  if (url.pathname === "/admin/api/login" && request.method === "POST") {
    const key = `admin:${request.headers.get("cf-connecting-ip") || "anonymous"}`;
    if (!(await env.CHAT_RATE_LIMITER.limit({ key })).success) {
      return json({ error: "Too many sign-in attempts. Wait a minute and try again." }, 429);
    }
    let payload;
    try { payload = await readJson(request, 2048); } catch { return json({ error: "Enter a valid password." }, 400); }
    if (typeof payload?.password !== "string" || !(await samePassword(payload.password, env.CHAT_ADMIN_PASSWORD))) {
      return json({ error: "That password is incorrect. Try again." }, 401);
    }
    return json({ authenticated: true }, 200, { "Set-Cookie": cookie(await createSession(env.CHAT_ADMIN_PASSWORD), SESSION_SECONDS, url) });
  }

  if (url.pathname === "/admin/api/logout" && request.method === "POST") {
    return json({ authenticated: false }, 200, { "Set-Cookie": cookie("", 0, url) });
  }

  if (!(await authenticated(request, env.CHAT_ADMIN_PASSWORD))) {
    return json({ error: "Sign in to view saved conversations." }, 401);
  }
  if (request.method !== "GET") return json({ error: "Not found." }, 404);
  if (url.pathname === "/admin/api/session") return json({ authenticated: true });
  if (!env.CHAT_DB) return json({ error: "Conversation storage is not configured yet." }, 503);

  const offset = offsetFrom(url);
  if (offset === null) return json({ error: "Invalid page." }, 400);
  const cutoff = retentionCutoff();
  if (url.pathname === "/admin/api/conversations") {
    const search = (url.searchParams.get("q") || "").trim().slice(0, 200);
    const { results } = await env.CHAT_DB.prepare(`
      WITH retained AS (SELECT * FROM chat_turns WHERE created_at >= ?1),
      visits AS (
        SELECT conversation_id, MIN(created_at) AS started_at, MAX(created_at) AS updated_at,
          COUNT(*) AS question_count, SUM(status = 'failed') AS failed_count
        FROM retained GROUP BY conversation_id
      )
      SELECT visits.*, (SELECT question FROM retained WHERE conversation_id = visits.conversation_id
        ORDER BY created_at, id LIMIT 1) AS first_question
      FROM visits WHERE ?2 = '' OR conversation_id IN (
        SELECT conversation_id FROM retained WHERE instr(lower(question), lower(?2)) > 0
          OR instr(lower(COALESCE(answer, '')), lower(?2)) > 0
      ) ORDER BY updated_at DESC, conversation_id DESC LIMIT 51 OFFSET ?3
    `).bind(cutoff, search, offset).all();
    return json({ conversations: results.slice(0, 50), nextOffset: results.length > 50 ? offset + 50 : null, retentionDays: RETENTION_DAYS });
  }

  const match = /^\/admin\/api\/conversations\/([^/]+)$/.exec(url.pathname);
  if (match && UUID_PATTERN.test(match[1])) {
    const { results } = await env.CHAT_DB.prepare(`
      SELECT id, created_at, question, answer, error, status FROM chat_turns
      WHERE conversation_id = ?1 AND created_at >= ?2 ORDER BY created_at, id LIMIT 101 OFFSET ?3
    `).bind(match[1], cutoff, offset).all();
    return json({ turns: results.slice(0, 100), nextOffset: results.length > 100 ? offset + 100 : null });
  }
  return json({ error: "Not found." }, 404);
}

export async function handleAdmin(request, env) {
  const url = new URL(request.url);
  try {
    if (url.pathname.startsWith("/admin/api/")) return await api(request, env, url);
    if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Not found." }, 404);
    const response = await env.ASSETS.fetch(request);
    const secured = new Response(response.body, response);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) secured.headers.set(name, value);
    return secured;
  } catch {
    console.error("Owner dashboard request failed");
    return json({ error: "The dashboard is unavailable. Try refreshing in a moment." }, 503);
  }
}
