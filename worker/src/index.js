import { PORTFOLIO_INSTRUCTIONS } from "./knowledge.js";
import { handleAdmin } from "./admin.js";
import { purgeExpiredConversations, recordQuestion, recordResult, UUID_PATTERN } from "./conversations.js";
import { readJson } from "./request.js";

const MAX_QUESTION_LENGTH = 800;
const MAX_HISTORY_MESSAGES = 6;

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function configuredOrigins(env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((message) => message && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({
      role: message.role,
      content: typeof message.content === "string" ? message.content.trim().slice(0, MAX_QUESTION_LENGTH) : "",
    }))
    .filter((message) => message.content);
}

function outputText(response) {
  return (response.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      return handleAdmin(request, env);
    }
    const origin = request.headers.get("Origin") || "";
    const allowed = configuredOrigins(env);

    if (!origin || !allowed.includes(origin)) {
      return json({ error: "This origin is not allowed." }, 403);
    }

    const corsHeaders = getCorsHeaders(origin);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST" || url.pathname !== "/ask") {
      return json({ error: "Not found." }, 404, corsHeaders);
    }

    if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL || !env.CHAT_DB) {
      return json({ error: "The assistant is not configured yet." }, 503, corsHeaders);
    }

    const rateKey = request.headers.get("cf-connecting-ip") || "anonymous";
    const rateLimit = await env.CHAT_RATE_LIMITER.limit({ key: rateKey });
    if (!rateLimit.success) {
      return json({ error: "Please wait a moment before asking another question." }, 429, corsHeaders);
    }

    let payload;
    try {
      payload = await readJson(request, 40000);
    } catch {
      return json({ error: "Send a valid question." }, 400, corsHeaders);
    }

    const question = typeof payload?.question === "string" ? payload.question.trim() : "";
    if (!question || question.length > MAX_QUESTION_LENGTH) {
      return json({ error: `Questions must be between 1 and ${MAX_QUESTION_LENGTH} characters.` }, 400, corsHeaders);
    }

    const history = sanitizeHistory(payload.history);
    // Older open tabs can omit the ID; each such request becomes a separate visit.
    const conversationId = payload.conversationId === undefined ? crypto.randomUUID() : payload.conversationId;
    if (typeof conversationId !== "string" || !UUID_PATTERN.test(conversationId)) {
      return json({ error: "Send a valid conversation ID." }, 400, corsHeaders);
    }
    let turnId;
    try {
      turnId = await recordQuestion(env, conversationId, question);
    } catch {
      console.error("Conversation storage is unavailable");
      return json({ error: "The assistant is temporarily unavailable. Please try again later." }, 503, corsHeaders);
    }
    const contents = [
      ...history.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      { role: "user", parts: [{ text: question }] },
    ];

    const unavailable = "The assistant is temporarily unavailable. Please try again later.";
    let answer;
    let failure;
    try {
      const model = encodeURIComponent(env.GEMINI_MODEL);
      const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(35000),
        headers: {
          "x-goog-api-key": env.GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: PORTFOLIO_INSTRUCTIONS }],
          },
          contents,
          generationConfig: {
            maxOutputTokens: 350,
            temperature: 0.3,
          },
          store: false,
        }),
      });
      if (!upstream.ok) {
        console.error("Gemini request failed", upstream.status);
        failure = unavailable;
      } else {
        answer = outputText(await upstream.json());
        if (!answer) failure = "The assistant did not return an answer. Please try again.";
      }
    } catch {
      failure = unavailable;
    }
    try {
      await recordResult(env, turnId, failure ? null : answer, failure || null);
    } catch {
      console.error("Could not save the assistant response");
      return json({ error: unavailable }, 503, corsHeaders);
    }
    if (failure) return json({ error: failure }, 502, corsHeaders);
    return json({ answer }, 200, corsHeaders);
  },
  async scheduled(_event, env) {
    await purgeExpiredConversations(env);
  },
};
