# BIG Content Studio

The AI-powered content engine for **Bradley Insurance Group (BIGINSURED.com)** — Canal Winchester, Ohio. One internal tool for writing blog posts, generating images, scheduling content, and tracking everything from idea to published.

Built with React 19 · TypeScript · Vite · Gemini 2.5 · Supabase · Netlify

---

## What This App Actually Does

This isn't a generic CMS — it's purpose-built around how BIG actually creates content:

1. **Trend Monitor** finds what Ohio insurance audiences are searching for right now (using Gemini + live Google Search)
2. **Blog Architect** turns a topic into a full SEO blog post — or a whole multi-part series — in BIG's brand voice
3. Every blog post automatically generates **3 image prompts** (hero, 2 inline) plus a YouTube thumbnail strategy
4. **Image Studio** turns those prompts into on-brand visuals, sized correctly for the website, Instagram, YouTube, or Facebook
5. **Content Pipeline** tracks each piece from "Not Started" through review to "Uploaded for Publishing" — synced live to both Supabase and the team's Google Sheet
6. **Content Calendar** shows the publishing schedule at a glance
7. **Content Audit** (formerly two separate tools) checks new titles against everything already published or scheduled, so you never accidentally write the same article twice, and tracks category balance (Home / Auto / Business / Claims) so coverage doesn't get lopsided

---

## Project Structure

```
content-studio/
├── components/          # All UI — one file per screen/feature
│   ├── Sidebar.tsx       # Left nav (Create / Manage / Intelligence)
│   ├── LandingPage.tsx   # Dashboard / home screen
│   ├── BlogBuilder.tsx   # Blog post + series generator
│   ├── ImageGenerator.tsx
│   ├── Pipeline.tsx      # Kanban-style content tracker
│   ├── SheetAuditor.tsx  # Content Audit (duplicate + balance check)
│   └── ...
├── services/             # All external API calls live here, not in components
│   ├── geminiService.ts  # Every Gemini API call — models are defined ONCE at the top
│   ├── supabaseClient.ts
│   ├── googleSheetsService.ts
│   ├── feedbackService.ts # Powers the thumbs up/down image learning loop
│   └── config.ts          # Supabase URLs, table names, bucket names
├── hooks/
│   └── useGeneratorSettings.ts  # Image generator settings, synced to Supabase
├── App.tsx               # Routing + auth gate logic
├── types.ts              # Shared TypeScript types (Tab, BlogPost, etc.)
└── netlify.toml           # Tells Netlify how to build/deploy
```

**Why this matters for editing later:** if a Gemini model name ever needs updating, change it once in `services/geminiService.ts` (in the `MODELS` constant at the top) — every component that generates content pulls from there.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in:
- `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/apikey)
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — from Supabase project → Settings → API

> Supabase credentials currently also have a fallback hardcoded in `services/config.ts` so the app works immediately for office use without every machine needing `.env.local` set up. Environment variables always take priority if present.

### 3. Run locally

```bash
npm run dev
```

Opens at `http://localhost:3000`

---

## Deploying Updates (Netlify)

Netlify is already connected to this GitHub repo. The flow going forward is:

1. Make changes (or have Claude make them)
2. Push to GitHub (`main` branch)
3. Netlify automatically detects the push and redeploys — usually live within 1-2 minutes

No manual deploy steps needed once it's connected. You can watch the deploy progress in the Netlify dashboard.

**Required Netlify environment variables** (Site settings → Environment variables):
| Key | Where to get it |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio |
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `GOOGLE_SHEETS_WEBHOOK_URL` | Apps Script deployment URL (optional — being phased out) |

---

## Supabase — What's Connected

**Tables:**
| Table | Purpose |
|---|---|
| `images` | Asset Gallery metadata |
| `blog_posts` | Published blog post records |
| `pipeline_items` | Active content pipeline cards |
| `pipeline_archives` | Completed/archived pipeline items |
| `image_feedback` | Thumbs up/down on generated images — feeds the learning engine so future generations lean into liked styles and avoid disliked ones |
| `user_settings` | Saves generator settings (prompt history, negative prompts, aspect ratios) so they persist across sessions |

**Storage Buckets:**
- `blog-images` — hero and inline images for published posts
- `ai-gallery` — all AI-generated images saved to the gallery

---

## Google Sheets — Being Phased Out

The app currently dual-writes content pipeline and blog schedule data to both Supabase **and** a Google Sheet, for legacy compatibility. The long-term plan is to drop the Sheets dependency entirely once Supabase is fully trusted as the source of truth.

**Where Sheets is still used:**
- `services/googleSheetsService.ts` — reads sheet data
- `components/Pipeline.tsx` — dual-writes pipeline status updates
- `components/SheetAuditor.tsx` (Content Audit) — currently checks titles against the sheet; this is the next thing to migrate fully to Supabase

When ready to fully cut over, removing Sheets means: deleting the webhook calls in `Pipeline.tsx`, removing `googleSheetsService.ts`, and updating `SheetAuditor.tsx` to query Supabase exclusively.

---

## Gemini Models In Use

Defined once in `services/geminiService.ts`:

| Model | Used for |
|---|---|
| `gemini-2.5-pro` | Blog posts, blog series (deep reasoning, long-form) |
| `gemini-2.5-flash` | Image analysis, trend research (fast, search-grounded) |
| `gemini-2.0-flash-preview-image-generation` | All image generation and editing |
| `gemini-2.5-flash-preview-tts` | Voiceover generation |

Google occasionally renames or deprecates model versions — if generation suddenly starts failing, this table + the `MODELS` constant at the top of `geminiService.ts` is the first place to check.

---

## Versioning

This project uses simple semantic versioning, tracked in `package.json` and shown live in the app sidebar (under the logo).

- **Current version: v2.0.0** — this rebuild (sidebar navigation, corrected Gemini models, Netlify config, consolidated Content Audit tool)
- Going forward, bump the version in `package.json` for every meaningful update:
  - **Patch** (v2.0.1): bug fixes, small tweaks
  - **Minor** (v2.1.0): new features, new tools, non-breaking improvements
  - **Major** (v3.0.0): structural rebuilds, breaking changes, major redesigns

---

## A Note on How This App Was Built

This project started in Google AI Studio and was migrated to a standard React/Vite/Netlify stack with Claude's help, one phase at a time. If you're picking this back up after time away — or handing it to a new developer — the honest context is: this is a solo-operator internal tool, not a polished SaaS product. Code comments and structure favor clarity over cleverness on purpose, since the person maintaining it (with AI help) is still learning to code.

---

**Bradley Insurance Group** · Canal Winchester, OH · [biginsured.com](https://biginsured.com)
