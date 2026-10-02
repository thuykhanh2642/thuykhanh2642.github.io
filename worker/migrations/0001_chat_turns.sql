CREATE TABLE chat_turns (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  error TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'failed'))
);

CREATE INDEX chat_turns_conversation_time ON chat_turns(conversation_id, created_at, id);
CREATE INDEX chat_turns_created_at ON chat_turns(created_at);
