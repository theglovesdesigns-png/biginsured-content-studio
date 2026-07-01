-- Run this once in Supabase SQL Editor to fix the Image Studio settings
-- persistence bug. The app code expects a dedicated 'user_settings' table
-- (NOT 'site_settings', which is a separate, unrelated generic config table).
--
-- This stores Image Studio generator state per session: prompt history,
-- selected style/lighting/camera/quality tags, negative prompt, and
-- chosen aspect ratios — so they persist across page reloads and devices.

create table if not exists user_settings (
    id uuid primary key default gen_random_uuid(),
    session_id text not null unique,
    prompt_history jsonb not null default '[]'::jsonb,
    selected_snippets jsonb not null default '[]'::jsonb,
    negative_prompt text default '',
    aspect_ratios jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);

-- Allow the app's anon key to read/write its own settings
alter table user_settings enable row level security;

create policy "Allow all access to user_settings"
    on user_settings
    for all
    using (true)
    with check (true);
