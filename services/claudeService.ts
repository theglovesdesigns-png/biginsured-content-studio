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
// SECURE PROXY CALL (STREAMING)
// claude-proxy.ts now streams its response as newline-delimited JSON
// chunks (changed 9/14/2026, to avoid Netlify's ~26s function timeout
// on long article generations — see the comment at the top of
// claude-proxy.ts for the full explanation). Each line is one of:
//   { "textDelta": "..." }                          — a piece of text
//   { "done": true, "stopReason": ..., "usage": ... } — the final line
//   { "error": "..." }                                — something went wrong mid-stream
// This function reads the stream, reassembles the full text, and returns
// it in the same shape callers already expect — so generateBlogPost below
// didn't need to change at all.
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

    if (!res.body) {
        throw new Error('Claude proxy returned no response body.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let stopReason: string | undefined;
    let usage: { input_tokens: number; output_tokens: number } | undefined;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep any incomplete trailing line for next chunk

        for (const line of lines) {
            if (!line.trim()) continue;

            let parsed: any;
            try {
                parsed = JSON.parse(line);
            } catch {
                continue; // skip a malformed line rather than failing the whole generation
            }

            if (parsed.error) {
                throw new Error(parsed.error);
            }
            if (typeof parsed.textDelta === 'string') {
                fullText += parsed.textDelta;
            }
            if (parsed.done) {
                stopReason = parsed.stopReason;
                usage = parsed.usage;
            }
        }
    }

    return { text: fullText, stopReason, usage };
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

Write the full article content in the "content" field of the JSON response. The response format itself is enforced automatically — you don't need to add any special markers or formatting instructions; just write naturally. The "content" field should contain the full article body in Markdown (## headings, **bold**, bulleted/numbered lists as appropriate) — this matches BIG's real published content format. Use quotation marks, apostrophes, dashes, or any punctuation exactly as normal writing requires.`;

// ============================================================
// STRUCTURED OUTPUT SCHEMA
// FIXED 9/15/2026: previously this file asked Claude to follow a
// two-part text format (a JSON header + a separately-delimited article
// body) via plain instructions. That fixed the original quote-escaping
// crash, but introduced a NEW failure mode: Claude occasionally didn't
// follow the delimiter instructions exactly, which surfaced as "Claude's
// response was missing the expected article content markers."
//
// The real fix is Claude's native structured-output feature
// (output_config.format below) — confirmed supported on claude-sonnet-5.
// This constrains Claude's response at the token level so it is
// STRUCTURALLY INCAPABLE of returning anything other than valid JSON
// matching this schema — including automatically escaping any quotes,
// apostrophes, or other punctuation inside string fields like "content".
// This is the same category of guarantee Gemini's responseSchema gave
// (which is why Gemini "felt more fluid" — it had this same guarantee
// the whole time). No more delimiter parsing, no more repair passes.
// ============================================================
const BLOG_POST_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string' },
        slug: { type: 'string' },
        excerpt: { type: 'string' },
        content: { type: 'string' },
        category: {
            type: 'string',
            enum: ['Home Insurance', 'Auto Insurance', 'Business Insurance', 'General Insurance', 'Claims'],
        },
        author: { type: 'string' },
        meta_title: { type: 'string' },
        meta_description: { type: 'string' },
        tags_keywords: { type: 'array', items: { type: 'string' } },
        estimated_reading_time: { type: 'string' },
        estimated_word_count: { type: 'number' },
        locality: { type: 'string', enum: ['Ohio', 'Central Ohio', 'National'] },
        hero_image_prompt: { type: 'string' },
        hero_image_alt: { type: 'string' },
        hero_image_caption: { type: 'string' },
        inline_images: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    prompt: { type: 'string' },
                    alt: { type: 'string' },
                    caption: { type: 'string' },
                    placement_note: { type: 'string' },
                },
                required: ['prompt', 'alt', 'caption', 'placement_note'],
                additionalProperties: false,
            },
        },
        youtube_thumbnail_prompt: { type: 'string' },
        youtube_thumbnail_text: { type: 'string' },
        youtube_thumbnail_color: { type: 'string' },
        youtube_thumbnail_suggestions: { type: 'string' },
        status: { type: 'string' },
        featured: { type: 'boolean' },
        inline_image_strategy: { type: 'string' },
    },
    required: [
        'title', 'slug', 'excerpt', 'content', 'category', 'author',
        'meta_title', 'meta_description', 'tags_keywords', 'estimated_reading_time',
        'estimated_word_count', 'locality', 'hero_image_prompt', 'hero_image_alt',
        'hero_image_caption', 'inline_images', 'youtube_thumbnail_prompt',
        'youtube_thumbnail_text', 'youtube_thumbnail_color', 'youtube_thumbnail_suggestions',
        'status', 'featured', 'inline_image_strategy',
    ],
    additionalProperties: false,
};

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
${categoryInstruction}`;

    try {
        const response = await callClaudeProxy({
            model: CLAUDE_MODEL,
            // RAISED 9/15/2026: a 2,000-word article body alone is
            // roughly 2,600 tokens, plus the surrounding JSON fields
            // (title, excerpt, meta fields, tags, image prompts, etc).
            // 8000 should have been comfortable margin on paper, but a
            // real generation was observed truncating mid-article around
            // ~900-1000 words — raising this to 16000 gives real headroom
            // rather than guessing at the exact minimum needed. Also see
            // the stop_reason check below, which now surfaces WHY a
            // response was cut short instead of failing silently into a
            // generic parse error.
            max_tokens: 16000,
            system: BLOG_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
            output_config: {
                format: {
                    type: 'json_schema',
                    schema: BLOG_POST_SCHEMA,
                },
            },
        });

        // If Claude was cut off by the token limit, say so clearly rather
        // than letting it fail as an opaque JSON parse error further down.
        // This was previously silently discarded even though the proxy
        // was already capturing it — fixed 9/15/2026.
        if (response.stopReason === 'max_tokens') {
            console.error('Claude generation hit max_tokens before finishing. Raw text so far:', response.text);
            throw new Error(
                'Claude ran out of room before finishing the article (hit the token limit). Try a shorter word-count target, or try generating again.'
            );
        }

        const rawText = response.text || '';
        if (!rawText.trim()) {
            throw new Error('Claude returned an empty response.');
        }

        // With output_config.format in place, Claude is structurally
        // constrained to return valid JSON matching BLOG_POST_SCHEMA —
        // no delimiter parsing, no repair pass, no "missing markers" error
        // is possible anymore. A JSON.parse failure here (with a non-
        // max_tokens stop reason) would mean something more fundamental
        // broke, not a formatting slip.
        let parsed: BlogPost;
        try {
            parsed = JSON.parse(rawText) as BlogPost;
        } catch (jsonError) {
            console.error('Claude structured-output parse failed. Raw text:', rawText);
            throw new Error(
                'Claude returned a response that could not be parsed, even with structured output enabled. Try generating again.'
            );
        }

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
