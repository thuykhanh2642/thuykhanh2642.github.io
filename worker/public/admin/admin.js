const byId = (id) => document.getElementById(id);
const status = byId("status");
const signInPanel = byId("sign-in-panel");
const dashboard = byId("dashboard");
const conversationList = byId("conversations");
const turns = byId("turns");
const transcript = document.querySelector(".transcript");
const moreConversations = byId("more-conversations");
const moreTurns = byId("more-turns");
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
let selectedId = null;
let selectedVisit = null;
let conversationOffset = null;
let turnOffset = null;
let search = "";
let listRequest = 0;
let detailRequest = 0;
let conversations = [];

function setSignedIn(signedIn) {
  signInPanel.hidden = signedIn;
  dashboard.hidden = !signedIn;
  byId("sign-out").hidden = !signedIn;
  byId("password").value = "";
  if (!signedIn) {
    listRequest += 1;
    detailRequest += 1;
    conversations = [];
    conversationList.replaceChildren();
    turns.replaceChildren();
    selectedId = null;
    selectedVisit = null;
    byId("search").value = "";
    search = "";
    moreConversations.hidden = true;
    moreTurns.hidden = true;
    byId("transcript-title").textContent = "Choose a conversation";
    byId("transcript-meta").textContent = "Select a visit to read its questions and replies.";
    byId("password").focus();
  }
}

async function api(path, options = {}) {
  const response = await fetch(`/admin/api/${path}`, { ...options, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !dashboard.hidden) setSignedIn(false);
    throw new Error(payload.error || "The dashboard couldn't load. Try again in a moment.");
  }
  return payload;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderConversations() {
  conversationList.replaceChildren();
  for (const visit of conversations) {
    const button = element("button", "conversation");
    button.type = "button";
    button.dataset.id = visit.conversation_id;
    button.setAttribute("aria-pressed", String(visit.conversation_id === selectedId));
    button.append(element("strong", "", visit.first_question));
    const failed = visit.failed_count ? ` · ${visit.failed_count} failed` : "";
    button.append(element("span", "", `${dateFormat.format(new Date(visit.updated_at))} · ${visit.question_count} ${visit.question_count === 1 ? "question" : "questions"}${failed}`));
    button.addEventListener("click", () => loadTranscript(visit));
    conversationList.append(button);
  }
}

async function loadConversations(append = false) {
  const requestId = ++listRequest;
  const offset = append ? conversationOffset : 0;
  if (offset === null) return;
  byId("list-status").textContent = append ? "Loading more visits…" : "Loading conversations…";
  byId("refresh").disabled = true;
  moreConversations.disabled = true;
  status.textContent = "";
  try {
    const payload = await api(`conversations?q=${encodeURIComponent(search)}&offset=${offset}`);
    if (requestId !== listRequest || dashboard.hidden) return;
    const combined = append ? [...conversations, ...payload.conversations] : payload.conversations;
    conversations = [...new Map(combined.map((visit) => [visit.conversation_id, visit])).values()];
    conversationOffset = payload.nextOffset;
    renderConversations();
    moreConversations.hidden = conversationOffset === null;
    byId("list-status").textContent = conversations.length ? "" : search ? "No conversations match that search." : "No conversations yet. New visits will appear here after someone asks a question.";
  } catch (error) {
    if (requestId === listRequest || dashboard.hidden) status.textContent = error.message;
    byId("list-status").textContent = "";
  } finally {
    if (requestId === listRequest || dashboard.hidden) {
      byId("refresh").disabled = false;
      moreConversations.disabled = false;
    }
  }
}

async function loadTranscript(visit, append = false) {
  const requestId = ++detailRequest;
  const offset = append ? turnOffset : 0;
  if (offset === null) return;
  selectedId = visit.conversation_id;
  selectedVisit = visit;
  renderConversations();
  if (!append) {
    turns.replaceChildren();
    moreTurns.hidden = true;
    byId("transcript-title").textContent = `Visit on ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(visit.started_at))}`;
    byId("transcript-meta").textContent = "Loading messages…";
  }
  transcript.setAttribute("aria-busy", "true");
  moreTurns.disabled = true;
  status.textContent = "";
  try {
    const payload = await api(`conversations/${encodeURIComponent(selectedId)}?offset=${offset}`);
    if (requestId !== detailRequest || dashboard.hidden) return;
    for (const turn of payload.turns) {
      const article = element("article", `turn ${turn.status === "failed" ? "failed" : ""}`);
      const time = element("time", "", dateFormat.format(new Date(turn.created_at)));
      time.dateTime = new Date(turn.created_at).toISOString();
      article.append(time, element("p", "message-label", "Visitor"), element("p", "message-body", turn.question));
      const label = turn.status === "answered" ? "Portfolio guide" : turn.status === "failed" ? "Chatbot unavailable" : "No reply recorded yet";
      const text = turn.answer || turn.error || "The request may still be running or may have been interrupted. Refresh to check again.";
      article.append(element("p", "message-label", label), element("p", "message-body", text));
      turns.append(article);
    }
    turnOffset = payload.nextOffset;
    moreTurns.hidden = turnOffset === null;
    byId("transcript-meta").textContent = payload.turns.length || append ? `Anonymous visit · ${visit.conversation_id.slice(0, 8)} · Times shown in your local timezone` : "This conversation has expired or has no saved messages.";
    if (!append) {
      byId("transcript-title").focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 720px)").matches) transcript.scrollIntoView({ block: "start" });
    }
  } catch (error) {
    if (requestId === detailRequest || dashboard.hidden) {
      status.textContent = error.message;
      byId("transcript-meta").textContent = "Couldn't load this conversation. Select it again to retry.";
    }
  } finally {
    if (requestId === detailRequest || dashboard.hidden) {
      transcript.setAttribute("aria-busy", "false");
      moreTurns.disabled = false;
    }
  }
}

byId("sign-in-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = byId("sign-in");
  button.disabled = true;
  status.textContent = "Signing in…";
  try {
    await api("login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: byId("password").value }) });
    setSignedIn(true);
    status.textContent = "";
    byId("search").focus();
    await loadConversations();
  } catch (error) {
    status.textContent = error.message;
    byId("password").value = "";
    byId("password").focus();
  } finally {
    button.disabled = false;
  }
});

byId("sign-out").addEventListener("click", async () => {
  byId("sign-out").disabled = true;
  try {
    await api("logout", { method: "POST" });
    setSignedIn(false);
    status.textContent = "Signed out.";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    byId("sign-out").disabled = false;
  }
});

byId("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  search = byId("search").value.trim();
  loadConversations();
});
byId("refresh").addEventListener("click", async () => {
  await loadConversations();
  const visit = conversations.find((item) => item.conversation_id === selectedId) || selectedVisit;
  if (visit && !dashboard.hidden) await loadTranscript(visit);
});
moreConversations.addEventListener("click", () => loadConversations(true));
moreTurns.addEventListener("click", () => {
  if (selectedVisit) loadTranscript(selectedVisit, true);
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  byId("theme-toggle").textContent = theme === "light" ? "Dark mode" : "Light mode";
  byId("theme-toggle").setAttribute("aria-label", `Switch to ${theme === "light" ? "dark" : "light"} mode`);
}
let theme = "dark";
try { theme = localStorage.getItem("portfolio-theme") === "light" ? "light" : "dark"; } catch { /* Use the default theme. */ }
applyTheme(theme);
byId("theme-toggle").addEventListener("click", () => {
  theme = theme === "light" ? "dark" : "light";
  applyTheme(theme);
  try { localStorage.setItem("portfolio-theme", theme); } catch { /* Theme still works for this page. */ }
});

(async () => {
  try {
    await api("session");
    setSignedIn(true);
    await loadConversations();
  } catch (error) {
    setSignedIn(false);
    if (error.message !== "Sign in to view saved conversations.") status.textContent = error.message;
  }
})();
