-- Run this once in Supabase SQL Editor to enable the persistent Audit Log
-- feature in the Content Audit tool.

create table if not exists audit_log (
    id uuid primary key default gen_random_uuid(),
    run_at timestamptz not null default now(),
    ideas_count integer not null default 0,
    schedule_count integer not null default 0,
    website_count integer not null default 0,
    duplicates_found integer not null default 0,
    notes text
);

-- Allow the app's anon key to read/write audit log entries
alter table audit_log enable row level security;

create policy "Allow all access to audit_log"
    on audit_log
    for all
    using (true)
    with check (true);
