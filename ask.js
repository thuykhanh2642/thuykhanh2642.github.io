const chatForm = document.getElementById("chat-form");
const chatQuestion = document.getElementById("chat-question");
const chatLog = document.getElementById("chat-log");
const chatStatus = document.getElementById("chat-status");
const chatSubmit = document.getElementById("chat-submit");
const chatPrompts = Array.from(document.querySelectorAll(".ask-prompt"));
const chatEndpoint = typeof window.PORTFOLIO_CHAT_ENDPOINT === "string"
  ? window.PORTFOLIO_CHAT_ENDPOINT.trim()
  : "";
const chatHistory = [];
let conversationId;
try {
  conversationId = sessionStorage.getItem("portfolio-conversation-id");
} catch {
  // Chat still works when browser storage is disabled.
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId || "")) {
  conversationId = crypto.randomUUID();
  try {
    sessionStorage.setItem("portfolio-conversation-id", conversationId);
  } catch {
    // Keep the visit ID in memory for this page instead.
  }
}

function scrollChat() {
  chatLog.scrollTo({ top: chatLog.scrollHeight, behavior: "smooth" });
}

function addMessage(role, content) {
  const message = document.createElement("article");
  const label = document.createElement("span");
  const body = document.createElement("p");

  message.className = "ask-message";
  message.dataset.role = role;
  label.textContent = role === "user" ? "You" : role === "error" ? "Unavailable" : "Portfolio guide";
  body.textContent = content;

  message.append(label, body);
  chatLog.append(message);
  scrollChat();
}

function addLoadingMessage() {
  const message = document.createElement("article");
  const label = document.createElement("span");
  const indicator = document.createElement("div");

  message.className = "ask-message";
  message.dataset.role = "assistant";
  label.textContent = "Portfolio guide";
  indicator.className = "ask-typing";
  indicator.setAttribute("role", "status");
  indicator.setAttribute("aria-label", "Generating a response");

  for (let index = 0; index < 3; index += 1) {
    const dot = document.createElement("span");
    dot.setAttribute("aria-hidden", "true");
    indicator.append(dot);
  }

  message.append(label, indicator);
  chatLog.append(message);
  scrollChat();
  return message;
}

function setLoading(isLoading) {
  chatForm.setAttribute("aria-busy", String(isLoading));
  chatSubmit.disabled = isLoading;
  chatQuestion.disabled = isLoading;
  chatPrompts.forEach((prompt) => {
    prompt.disabled = isLoading;
  });
}

function getErrorMessage(error) {
  if (error.name === "AbortError") {
    return "The response took too long. Please try again.";
  }

  return error.message || "The assistant is unavailable right now. Please try again later.";
}

async function askQuestion(question, history) {
  if (!chatEndpoint) {
    throw new Error("This assistant is still being set up. You can reach Khanh through the contact page.");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(chatEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history, conversationId }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "The assistant is unavailable right now. Please try again later.");
    }

    if (typeof payload.answer !== "string" || !payload.answer.trim()) {
      throw new Error("The assistant returned an empty response. Please try again.");
    }

    return payload.answer.trim();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function submitQuestion(question) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) {
    return;
  }

  const context = chatHistory.slice(-6);
  addMessage("user", cleanQuestion);
  chatHistory.push({ role: "user", content: cleanQuestion });
  chatQuestion.value = "";
  chatStatus.textContent = "";
  setLoading(true);
  const loadingMessage = addLoadingMessage();

  try {
    const answer = await askQuestion(cleanQuestion, context);
    loadingMessage.remove();
    addMessage("assistant", answer);
    chatHistory.push({ role: "assistant", content: answer });
  } catch (error) {
    loadingMessage.remove();
    const message = getErrorMessage(error);
    addMessage("error", message);
    chatStatus.textContent = message;
  } finally {
    setLoading(false);
    chatQuestion.focus();
  }
}

if (chatForm && chatQuestion && chatLog && chatStatus && chatSubmit) {
  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitQuestion(chatQuestion.value);
  });

  chatPrompts.forEach((prompt) => {
    prompt.addEventListener("click", () => {
      submitQuestion(prompt.dataset.question || "");
    });
  });
}
