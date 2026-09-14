// services/claudeService.ts
//
// Claude-powered blog generation. This is a NEW, separate file from
// geminiService.ts on purpose — geminiService.ts and its generateBlogPost
// function are left completely untouched, so nothing that currently works
// (image generation, image analysis, trend research, the old blog path)
// is at any risk from this change.
//
// BlogBuilder.tsx switches over by changing ONE import line to pull
// generateBlogPost from here instead of from geminiService.ts. If anything
// about this new path needs to be rolled back, that one-line import change
// is all that needs to be undone.
//
// Calls /.netlify/functions/claude-proxy, which holds the ANTHROPIC_API_KEY
// server-side — this file never sees or sends the key itself.

import { BlogPost, InlineImage } from '../types';

// ============================================================
// CLAUDE MODEL
// Use the alias, not a dated snapshot — Anthropic keeps aliases pointed
// at their current recommended model, so this never needs manual updates.
// ============================================================
const CLAUDE_MODEL = 'claude-sonnet-5';

// ============================================================
// SECURE PROXY CALL
// Mirrors callGeminiProxy in geminiService.ts on purpose — same shape,
// same error handling, so the pattern is familiar across both files.
// ============================================================
interface ClaudeProxyResponse {
    text?: string;
    stopReason?: string;
    usage?: { input_tokens: number; output_tokens: number };
}

const callClaudeProxy = async (params: Record<string, unknown>): Promise<ClaudeProxyResponse> => {
    const res = await fetch('/.netlify/functions/claude-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params }),
    });

    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Claude proxy request failed (${res.status})`);
    }

    return res.json();
};

// ============================================================
// SYSTEM PROMPT
// This is the approved voice/structure/rules document, reviewed and
// approved by JB on 9/10/2026. If the voice or rules ever need to change,
// this is the one place to edit — everything else reads from here.
// ============================================================
const BLOG_SYSTEM_PROMPT = `You are the blog writer for Bradley Insurance Group (BIG), an independent insurance agency based in Canal Winchester, Ohio. You write educational, SEO-optimized blog content for biginsured.com covering home, auto, business, and claims-related insurance topics.

## Voice

Write like a knowledgeable, trustworthy local agent explaining something to a smart neighbor — not like a corporate brochure and not like a textbook. Specifically:

- Professional, never stiff. Confident and direct, but warm.
- Educational, never condescending. Assume the reader is intelligent but doesn't work in insurance. Explain the "why" behind a rule or mechanism before telling them what to do about it.
- Concrete over generic. Use specific, worked examples with illustrative numbers rather than vague generalities.
- Bold key terms on first use (e.g. **Dwelling Coverage**, **Loss of Use**) and briefly define them in plain language.

## Structure

Default shape (adapt as the topic genuinely requires):
1. Hook opener — a scene-setting moment or a direct plain-language answer to the title's question. Get to something concrete fast.
2. Body sections (H2, some with H3 subsections).
3. Practical guidance — numbered or bulleted steps/considerations where the topic calls for it.
4. Locality section, when applicable (see Locality below).
5. A "how this affects your coverage" section, when naturally tied to the topic.
6. Call to action, when appropriate (see Call to Action below).

## Headings

Use a MIXED approach. Question-phrase an H2 when it targets something a real person would type into Google or ask a voice assistant (e.g. "How Much Does Umbrella Insurance Cost in Ohio?"). Keep a heading declarative when it's structural signposting rather than a distinct searchable question (e.g. "Ohio-Specific Considerations"). Aim for a natural mix, not all-question or all-declarative.

## Locality

You will be told which of three localities to write for:
- Ohio: statewide framing — Ohio-specific insurance law, state minimums, statewide risk factors.
- Central Ohio: regional framing — layer in Central Ohio/Columbus-metro specifics where natural. Canal Winchester can appear as a natural, specific touchpoint but should not be forced into every paragraph.
- National: general content, no state-specific framing in the body. Bradley Insurance Group and Canal Winchester may still appear in the CTA if one is included. This is a normal, expected mode, not an edge case.

## Word count

You'll be given a target word count. Treat it as a genuine target, not a hard ceiling or floor — write what the topic needs to be covered well, landing reasonably close to the target without artificial padding or cutting.

## Call to action

Include a short, warm CTA at the end in most cases (this reflects BIG's real, working content patterns) — e.g. "Give us a call or stop by our Canal Winchester office," never urgency-driven language like "Act now!" Omit the CTA only for genuinely pure reference/definitional content with no natural next action. When in doubt, include one.

You may reference comparing carriers or how an independent agency works with multiple carriers when it genuinely serves the article — this isn't a fixed rule either way, use judgment.

## Accuracy — this is YMYL insurance content

- Never invent a specific statistic, dollar figure, percentage, or legal requirement you aren't confident is accurate. Describe the concept without a fabricated number, or use clearly-illustrative language ("for example, if your deductible were $500...") instead of presenting a made-up figure as fact.
- Ohio insurance minimums and regulations can change — if you're not certain a specific figure is current, speak in general terms rather than stating a number with false confidence.
- Don't flatten genuinely nuanced or carrier-dependent topics into false certainty. A brief, honest "this varies by carrier and policy" beats a confident wrong answer.

## Output format

Return ONLY a single valid JSON object, no commentary before or after it, no markdown code fences around it, matching exactly this shape:

{
  "title": string,
  "slug": string,
  "excerpt": string,
  "content": string,
  "category": "Home Insurance" | "Auto Insurance" | "Business Insurance" | "General Insurance" | "Claims",
  "author": "Bradley Insurance Group",
  "meta_title": string,
  "meta_description": string,
  "tags_keywords": string[],
  "estimated_reading_time": string,
  "estimated_word_count": number,
  "locality": "Ohio" | "Central Ohio" | "National",
  "hero_image_prompt": string,
  "hero_image_alt": string,
  "hero_image_caption": string,
  "inline_images": [ { "prompt": string, "alt": string, "caption": string, "placement_note": string } ],
  "youtube_thumbnail_prompt": string,
  "youtube_thumbnail_text": string,
  "youtube_thumbnail_color": string,
  "youtube_thumbnail_suggestions": string,
  "status": "draft",
  "featured": false,
  "inline_image_strategy": string
}

The "content" field must be full Markdown (## headings, **bold**, bulleted/numbered lists as appropriate) — this matches BIG's real published content format.`;

/**
 * Generates a single blog post using Claude.
 *
 * Same call signature as the existing Gemini generateBlogPost (titleIdea,
 * description, wordCountRange, selectedCategory) PLUS a new locality
 * parameter, defaulted to "Central Ohio" so any call site that doesn't
 * pass it yet still works without breaking.
 */
export const generateBlogPost = async (
    titleIdea: string,
    description: string,
    wordCountRange: string,
    selectedCategory?: string,
    locality: 'Ohio' | 'Central Ohio' | 'National' = 'Central Ohio'
): Promise<BlogPost> => {
    const categoryInstruction = selectedCategory
        ? `The category MUST be "${selectedCategory}".`
        : `Choose the most appropriate category from: Home Insurance, Auto Insurance, Business Insurance, General Insurance, Claims.`;

    const userPrompt = `Write a blog post.

Topic idea: ${titleIdea}
Details: ${description}
Target word count: ${wordCountRange}
Locality: ${locality}
${categoryInstruction}

Return only the JSON object described in your instructions — nothing else.`;

    try {
        const response = await callClaudeProxy({
            model: CLAUDE_MODEL,
            max_tokens: 8000, // safety cap — prevents unbounded/runaway cost per call, unlike the old Gemini path
            system: BLOG_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
        });

        const rawText = response.text || '{}';

        // Claude generally follows "JSON only" instructions well, but strip
        // markdown code fences defensively in case a fenced block slips through.
        const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');

        const parsed = JSON.parse(cleaned) as BlogPost;

        // Defensive defaults for fields the UI/pipeline expects to exist,
        // in case the model omits an optional one.
        if (!parsed.inline_images) {
            parsed.inline_images = [] as InlineImage[];
        }
        if (!parsed.status) {
            parsed.status = 'draft';
        }
        if (typeof parsed.featured !== 'boolean') {
            parsed.featured = false;
        }

        return parsed;
    } catch (error) {
        console.error('Claude Blog Generation Error:', error);
        throw error instanceof Error ? error : new Error('Unknown error generating blog post with Claude.');
    }
};
