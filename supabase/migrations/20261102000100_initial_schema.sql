-- ZARA PostgreSQL primary database.
-- Keep D1 intact until data parity and production cutover are explicitly verified.
create table if not exists public.settings (
  id text primary key check (id = 'owner'),
  data_json jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.memories (
  id text primary key,
  category text not null check (category in ('preference','fact','instruction','contact','task')),
  memory_key text not null,
  value text not null,
  importance text not null check (importance in ('high','medium','low')),
  user_approved boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists idx_memories_active_approved on public.memories(is_active,user_approved,importance);

create table if not exists public.whatsapp_messages (
  id text primary key,
  contact_name text not null,
  contact_identifier text,
  message_text text not null,
  status text not null check (status in ('pending','confirmed','sent','simulated','cancelled')),
  user_confirmed boolean not null default false,
  is_sensitive boolean not null default false,
  sent_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_whatsapp_created_at on public.whatsapp_messages(created_at desc);

create table if not exists public.automation_history (
  id text primary key,
  job_id text not null,
  name text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_ms integer,
  status text not null check (status in ('running','completed','failed')),
  result_summary text,
  error text
);
create index if not exists idx_automation_started_at on public.automation_history(started_at desc);

create table if not exists public.usage_logs (
  id text primary key,
  model_id text not null,
  task_type text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  latency_ms integer not null default 0,
  status text not null check (status in ('success','failed','fallback')),
  created_at timestamptz not null default now()
);
create index if not exists idx_usage_created_at on public.usage_logs(created_at desc);

create table if not exists public.rate_limits (
  bucket_key text primary key,
  window_start bigint not null,
  request_count integer not null,
  expires_at bigint not null
);
create index if not exists idx_rate_limits_expiry on public.rate_limits(expires_at);

create table if not exists public.memory_backups (
  id text primary key,
  created_at timestamptz not null default now(),
  memory_count integer not null,
  payload_json jsonb not null
);

create table if not exists public.conversations (
  id text primary key,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_messages (
  id text primary key,
  conversation_id text not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','zara')),
  content text not null,
  language text not null check (language in ('urdu','roman_urdu','english')),
  model_used text,
  created_at timestamptz not null default now()
);
create index if not exists idx_conversation_messages on public.conversation_messages(conversation_id,created_at);

-- All data access is server-side through the Worker secret key.
-- No browser role gets table privileges; RLS remains enabled as defense in depth.
alter table public.settings enable row level security;
alter table public.memories enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.automation_history enable row level security;
alter table public.usage_logs enable row level security;
alter table public.rate_limits enable row level security;
alter table public.memory_backups enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

revoke all on public.settings, public.memories, public.whatsapp_messages, public.automation_history,
  public.usage_logs, public.rate_limits, public.memory_backups, public.conversations,
  public.conversation_messages from anon, authenticated;
grant all on public.settings, public.memories, public.whatsapp_messages, public.automation_history,
  public.usage_logs, public.rate_limits, public.memory_backups, public.conversations,
  public.conversation_messages to service_role;

create or replace function public.zara_increment_rate_limit(
  p_bucket_key text, p_window_start bigint, p_expires_at bigint
) returns integer
language sql
security invoker
set search_path = ''
as $$
  insert into public.rate_limits(bucket_key,window_start,request_count,expires_at)
  values(p_bucket_key,p_window_start,1,p_expires_at)
  on conflict(bucket_key) do update
    set request_count = public.rate_limits.request_count + 1
  returning request_count;
$$;
revoke all on function public.zara_increment_rate_limit(text,bigint,bigint) from public, anon, authenticated;
grant execute on function public.zara_increment_rate_limit(text,bigint,bigint) to service_role;
