-- ZARA Cloudflare D1 initial schema.
-- Single-owner migration schema. Do not import JSON data until its owner approves the transfer.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY CHECK (id = 'owner'),
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('preference','fact','instruction','contact','task')),
  memory_key TEXT NOT NULL,
  value TEXT NOT NULL,
  importance TEXT NOT NULL CHECK (importance IN ('high','medium','low')),
  user_approved INTEGER NOT NULL DEFAULT 0 CHECK (user_approved IN (0,1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_memories_active_approved ON memories(is_active, user_approved, importance);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id TEXT PRIMARY KEY,
  contact_name TEXT NOT NULL,
  contact_identifier TEXT,
  message_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','confirmed','sent','simulated','cancelled')),
  user_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (user_confirmed IN (0,1)),
  is_sensitive INTEGER NOT NULL DEFAULT 0 CHECK (is_sensitive IN (0,1)),
  sent_at TEXT,
  provider_message_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_created_at ON whatsapp_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS automation_history (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
  result_summary TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_automation_started_at ON automation_history(started_at DESC);

CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success','failed','fallback')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expiry ON rate_limits(expires_at);

CREATE TABLE IF NOT EXISTS memory_backups (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  memory_count INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','zara')),
  content TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('urdu','roman_urdu','english')),
  model_used TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversation_messages ON conversation_messages(conversation_id, created_at);
