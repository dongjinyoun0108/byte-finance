-- Run once in the Supabase SQL editor.

-- One row per published post, so a day is never posted twice.
create table if not exists public.posts (
  key          text primary key,          -- e.g. morning-2026-10-07
  kind         text not null,
  status       text not null,
  ig_media_id  text,
  image_url    text,
  caption      text,
  payload      jsonb,
  created_at   timestamptz not null default now()
);

-- Every run that did something (posted, skipped, failed), for troubleshooting.
create table if not exists public.runs (
  id         bigserial primary key,
  job        text not null,
  status     text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);

-- Canva's rotating refresh token lives here (written by `npm run canva-auth`, then by every run).
create table if not exists public.app_secrets (
  name       text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- Only the service role key (server-side) can read or write these.
alter table public.posts enable row level security;
alter table public.runs enable row level security;
alter table public.app_secrets enable row level security;

-- Public bucket for the carousel JPGs (Instagram fetches them by URL).
insert into storage.buckets (id, name, public) values ('cards', 'cards', true)
on conflict (id) do nothing;
