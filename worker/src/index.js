import { PORTFOLIO_INSTRUCTIONS } from "./knowledge.js";

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
    const origin = request.headers.get("Origin") || "";
    const allowed = configuredOrigins(env);

    if (!origin || !allowed.includes(origin)) {
      return json({ error: "This origin is not allowed." }, 403);
    }

    const corsHeaders = getCorsHeaders(origin);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/ask") {
      return json({ error: "Not found." }, 404, corsHeaders);
    }

    if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) {
      return json({ error: "The assistant is not configured yet." }, 503, corsHeaders);
    }

    const rateKey = request.headers.get("cf-connecting-ip") || "anonymous";
    const rateLimit = await env.CHAT_RATE_LIMITER.limit({ key: rateKey });
    if (!rateLimit.success) {
      return json({ error: "Please wait a moment before asking another question." }, 429, corsHeaders);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Send a valid question." }, 400, corsHeaders);
    }

    const question = typeof payload.question === "string" ? payload.question.trim() : "";
    if (!question || question.length > MAX_QUESTION_LENGTH) {
      return json({ error: `Questions must be between 1 and ${MAX_QUESTION_LENGTH} characters.` }, 400, corsHeaders);
    }

    const history = sanitizeHistory(payload.history);
    const contents = [
      ...history.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      { role: "user", parts: [{ text: question }] },
    ];

    let upstream;
    try {
      const model = encodeURIComponent(env.GEMINI_MODEL);
      upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
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
    } catch {
      return json({ error: "The assistant is temporarily unavailable. Please try again later." }, 502, corsHeaders);
    }

    if (!upstream.ok) {
      console.error("Gemini request failed", upstream.status);
      return json({ error: "The assistant is temporarily unavailable. Please try again later." }, 502, corsHeaders);
    }

    const response = await upstream.json();
    const answer = outputText(response);
    if (!answer) {
      return json({ error: "The assistant did not return an answer. Please try again." }, 502, corsHeaders);
    }

    return json({ answer }, 200, corsHeaders);
  },
};
