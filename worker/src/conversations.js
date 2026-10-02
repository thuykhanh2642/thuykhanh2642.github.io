export const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function retentionCutoff() {
  return Date.now() - RETENTION_MS;
}

export async function recordQuestion(env, conversationId, question) {
  const id = crypto.randomUUID();
  await env.CHAT_DB.prepare(
    "INSERT INTO chat_turns (id, conversation_id, created_at, question) VALUES (?1, ?2, ?3, ?4)",
  ).bind(id, conversationId, Date.now(), question).run();
  return id;
}

export async function recordResult(env, id, answer, error = null) {
  await env.CHAT_DB.prepare(
    "UPDATE chat_turns SET answer = ?1, error = ?2, status = ?3 WHERE id = ?4",
  ).bind(answer, error, error ? "failed" : "answered", id).run();
}

export async function purgeExpiredConversations(env) {
  await env.CHAT_DB.prepare("DELETE FROM chat_turns WHERE created_at < ?1")
    .bind(retentionCutoff()).run();
}
