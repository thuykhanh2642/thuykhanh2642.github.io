import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, mock, test } from "node:test";
import worker from "../src/index.js";

const ownerOrigin = "https://chat.example";
const portfolioOrigin = "https://portfolio.example";
const password = "test-password-16";
const visitId = "d9135f29-b14f-421f-bd89-adf46c55c094";
let database;
let env;

// Execute the production SQL against SQLite rather than mocking query results.
function d1(db) {
  return {
    prepare(sql) {
      const statement = db.prepare(sql);
      return {
        bind(...values) {
          return {
            async run() { return statement.run(...values); },
            async all() { return { results: statement.all(...values) }; },
          };
        },
      };
    },
  };
}

beforeEach(() => {
  database = new DatabaseSync(":memory:");
  database.exec(readFileSync(new URL("../migrations/0001_chat_turns.sql", import.meta.url), "utf8"));
  env = {
    ALLOWED_ORIGINS: portfolioOrigin,
    GEMINI_MODEL: "test-model",
    GEMINI_API_KEY: "synthetic-api-key",
    CHAT_ADMIN_PASSWORD: password,
    CHAT_DB: d1(database),
    CHAT_RATE_LIMITER: { async limit() { return { success: true }; } },
  };
});
afterEach(() => { mock.restoreAll(); database.close(); });

function request(path, { method = "GET", body, cookie, origin = ownerOrigin } = {}) {
  return new Request(`${ownerOrigin}${path}`, {
    method,
    headers: { Origin: origin, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function login() {
  const response = await worker.fetch(request("/admin/api/login", { method: "POST", body: { password } }), env);
  assert.equal(response.status, 200);
  return response.headers.get("Set-Cookie").split(";")[0];
}

function upstreamAnswer(answer = "Khanh builds reinforcement learning controllers.") {
  mock.method(globalThis, "fetch", async () => Response.json({ candidates: [{ content: { parts: [{ text: answer }] } }] }));
}

function ask(question = "What did Khanh build?", conversationId = visitId) {
  return worker.fetch(request("/ask", { method: "POST", origin: portfolioOrigin, body: { question, conversationId } }), env);
}

test("public visitors cannot retrieve any transcript, including with a forged cookie", async () => {
  const response = await worker.fetch(request("/admin/api/conversations"), env);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  const forged = `portfolio_admin=${Math.floor(Date.now() / 1000) + 1000}.${visitId}.${"x".repeat(43)}`;
  assert.equal((await worker.fetch(request(`/admin/api/conversations/${visitId}`, { cookie: forged }), env)).status, 401);
});

test("owner signs in with a protected cookie and can sign out", async () => {
  const response = await worker.fetch(request("/admin/api/login", { method: "POST", body: { password } }), env);
  const cookie = response.headers.get("Set-Cookie");
  assert.match(cookie, /HttpOnly; SameSite=Strict; Path=\/admin; Max-Age=28800; Secure/);
  assert.equal((await worker.fetch(request("/admin/api/session", { cookie: cookie.split(";")[0] }), env)).status, 200);
  const logout = await worker.fetch(request("/admin/api/logout", { method: "POST", cookie: cookie.split(";")[0] }), env);
  assert.match(logout.headers.get("Set-Cookie"), /Max-Age=0/);
});

test("wrong passwords, cross-origin sign-in, missing setup, and throttled login are rejected", async () => {
  assert.equal((await worker.fetch(request("/admin/api/login", { method: "POST", body: { password: "wrong" } }), env)).status, 401);
  assert.equal((await worker.fetch(request("/admin/api/login", { method: "POST", origin: portfolioOrigin, body: { password } }), env)).status, 403);
  env.CHAT_RATE_LIMITER.limit = async () => ({ success: false });
  assert.equal((await worker.fetch(request("/admin/api/login", { method: "POST", body: { password } }), env)).status, 429);
  env.CHAT_ADMIN_PASSWORD = "short";
  assert.equal((await worker.fetch(request("/admin/api/session"), env)).status, 503);
});

test("owner passwords accept 16 characters and reject 15", async () => {
  assert.equal(password.length, 16);
  env.CHAT_ADMIN_PASSWORD = password.slice(0, 15);
  const tooShort = await worker.fetch(request("/admin/api/session"), env);
  assert.equal(tooShort.status, 503);
  assert.match((await tooShort.json()).error, /at least 16 characters/);
  env.CHAT_ADMIN_PASSWORD = password;
  const cookie = await login();
  assert.equal((await worker.fetch(request("/admin/api/session", { cookie }), env)).status, 200);
});

test("expired sessions and cookies signed with an old password are rejected", async () => {
  const originalNow = Date.now;
  const cookie = await login();
  mock.method(Date, "now", () => originalNow() + 9 * 60 * 60 * 1000);
  assert.equal((await worker.fetch(request("/admin/api/conversations", { cookie }), env)).status, 401);
  mock.restoreAll();
  env.CHAT_ADMIN_PASSWORD = "a-different-synthetic-owner-password-123456";
  assert.equal((await worker.fetch(request("/admin/api/conversations", { cookie }), env)).status, 401);
});

test("questions and replies are saved and grouped into a full conversation", async () => {
  upstreamAnswer();
  assert.equal((await ask()).status, 200);
  assert.equal((await ask("What tools did he use?")).status, 200);
  const cookie = await login();
  const list = await (await worker.fetch(request("/admin/api/conversations", { cookie }), env)).json();
  assert.equal(list.conversations.length, 1);
  assert.equal(list.conversations[0].question_count, 2);
  const detail = await (await worker.fetch(request(`/admin/api/conversations/${visitId}`, { cookie }), env)).json();
  assert.equal(detail.turns.length, 2);
  assert.ok(detail.turns.every((turn) => turn.status === "answered" && turn.answer));
});

test("failed and malformed upstream responses preserve the visitor question", async () => {
  mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 503 }));
  assert.equal((await ask()).status, 502);
  let row = database.prepare("SELECT * FROM chat_turns").get();
  assert.equal(row.status, "failed");
  assert.equal(row.question, "What did Khanh build?");
  assert.equal(row.answer, null);
  assert.ok(row.error);
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => new Response("invalid JSON"));
  assert.equal((await ask("Another question")).status, 502);
  row = database.prepare("SELECT COUNT(*) AS count FROM chat_turns WHERE status = 'failed'").get();
  assert.equal(row.count, 2);
});

test("invalid IDs, questions, bodies, and disallowed origins are not saved", async () => {
  upstreamAnswer();
  assert.equal((await ask("hello", "not-a-uuid")).status, 400);
  assert.equal((await ask(" ")).status, 400);
  assert.equal((await ask("x".repeat(801))).status, 400);
  assert.equal((await worker.fetch(request("/ask", { method: "POST", origin: "https://other.example", body: { question: "hello" } }), env)).status, 403);
  assert.equal((await worker.fetch(request("/ask", { method: "POST", origin: portfolioOrigin, body: null }), env)).status, 400);
  assert.equal((await worker.fetch(request("/ask", { method: "POST", origin: portfolioOrigin, body: { question: "hello", history: "x".repeat(40001) } }), env)).status, 400);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM chat_turns").get().count, 0);
});

test("storage failures fail gracefully without making an upstream request", async () => {
  const upstream = mock.method(globalThis, "fetch", async () => { throw new Error("should not call"); });
  env.CHAT_DB.prepare = () => { throw new Error("storage offline"); };
  assert.equal((await ask()).status, 503);
  assert.equal(upstream.mock.callCount(), 0);
});

test("search treats visitor content as data and searches both questions and answers", async () => {
  const malicious = "<script>alert('x')</script> '); DROP TABLE chat_turns; --";
  upstreamAnswer("The answer mentions Shifter.");
  await ask(malicious);
  const cookie = await login();
  for (const term of ["SHIFTER", "DROP TABLE"]) {
    const result = await (await worker.fetch(request(`/admin/api/conversations?q=${encodeURIComponent(term)}`, { cookie }), env)).json();
    assert.equal(result.conversations.length, 1);
    assert.equal(result.conversations[0].first_question, malicious);
  }
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM chat_turns").get().count, 1);
});

test("expired turns are hidden immediately and removed by scheduled cleanup", async () => {
  const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
  database.prepare("INSERT INTO chat_turns (id, conversation_id, created_at, question) VALUES (?, ?, ?, ?)").run(crypto.randomUUID(), visitId, old, "expired question");
  const cookie = await login();
  const list = await (await worker.fetch(request("/admin/api/conversations", { cookie }), env)).json();
  assert.equal(list.conversations.length, 0);
  const detail = await (await worker.fetch(request(`/admin/api/conversations/${visitId}`, { cookie }), env)).json();
  assert.equal(detail.turns.length, 0);
  await worker.scheduled({}, env);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM chat_turns").get().count, 0);
});

test("conversation lists and long transcripts are paginated without truncating access", async () => {
  const insert = database.prepare("INSERT INTO chat_turns (id, conversation_id, created_at, question) VALUES (?, ?, ?, ?)");
  for (let index = 0; index < 55; index += 1) insert.run(crypto.randomUUID(), crypto.randomUUID(), Date.now() + index, `Visit ${index}`);
  for (let index = 0; index < 105; index += 1) insert.run(crypto.randomUUID(), visitId, Date.now() + index, `Message ${index}`);
  const cookie = await login();
  const list = await (await worker.fetch(request("/admin/api/conversations", { cookie }), env)).json();
  assert.equal(list.conversations.length, 50);
  assert.equal(list.nextOffset, 50);
  const next = await (await worker.fetch(request("/admin/api/conversations?offset=50", { cookie }), env)).json();
  assert.equal(next.conversations.length, 6);
  assert.equal(next.nextOffset, null);
  const detail = await (await worker.fetch(request(`/admin/api/conversations/${visitId}`, { cookie }), env)).json();
  assert.equal(detail.turns.length, 100);
  assert.equal(detail.nextOffset, 100);
  const nextTurns = await (await worker.fetch(request(`/admin/api/conversations/${visitId}?offset=100`, { cookie }), env)).json();
  assert.equal(nextTurns.turns.length, 5);
  assert.equal((await worker.fetch(request("/admin/api/conversations?offset=-1", { cookie }), env)).status, 400);
});
