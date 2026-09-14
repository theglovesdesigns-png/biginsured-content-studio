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

Return ONLY a single valid JSON object, no commentary before or after it, no markdown code fences around it, matching exactly this shape:

CRITICAL JSON VALIDITY RULE: Any double-quote character (") that appears INSIDE a string value — for example if you quote a phrase, write $300,000 with quotation marks around a term, or use "smart quotes" in a sentence — MUST be escaped as \\" so the JSON stays valid. The same applies to any literal backslash (\\) or newline inside a string value (escape as \\\\ and \\n respectively). This is not optional — a single unescaped quote inside a string breaks the entire response. When in doubt, prefer rewording to avoid quotation marks inside your prose entirely (e.g. write "quote-unquote full coverage" as a plain phrase without quotation marks) rather than risk an unescaped quote.

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
 * Parses Claude's JSON output, with a fallback repair pass for the one
 * known failure mode: an unescaped double-quote character INSIDE a string
 * value (e.g. Claude writes a quoted phrase in the article body without
 * escaping it). The system prompt instructs Claude to escape these, but
 * this is a defensive second layer so a rare slip doesn't surface as a
 * raw parse error in the UI.
 *
 * The repair strategy: walk the raw text character by character, tracking
 * whether we're currently inside a JSON string. If we hit a `"` that is
 * NOT immediately followed by a JSON structural character (`,` `:` `}` `]`
 * or whitespace-then-one-of-those), it's almost certainly a quote INSIDE
 * the string content rather than the string's closing quote — so we
 * escape it instead of treating it as the end of the string.
 */
const parseBlogPostJson = (rawJson: string): BlogPost => {
    try {
        return JSON.parse(rawJson) as BlogPost;
    } catch (firstError) {
        console.warn('Claude JSON parse failed on first attempt, trying repair pass:', firstError);

        let repaired = '';
        let inString = false;
        let escapeNext = false;

        for (let i = 0; i < rawJson.length; i++) {
            const char = rawJson[i];

            if (escapeNext) {
                repaired += char;
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                repaired += char;
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                if (!inString) {
                    // Opening a string — always a real quote.
                    inString = true;
                    repaired += char;
                    continue;
                }
                // We're inside a string and hit a quote. Look ahead past
                // whitespace to see what comes next.
                let j = i + 1;
                while (j < rawJson.length && /\s/.test(rawJson[j])) j++;
                const next = rawJson[j];
                const looksLikeRealClose = next === undefined || [',', ':', '}', ']'].includes(next);

                if (looksLikeRealClose) {
                    inString = false;
                    repaired += char;
                } else {
                    // This quote is inside the string's actual content —
                    // escape it instead of ending the string here.
                    repaired += '\\"';
                }
                continue;
            }

            repaired += char;
        }

        try {
            return JSON.parse(repaired) as BlogPost;
        } catch (secondError) {
            // Repair pass didn't fix it either — surface a clear error
            // rather than a cryptic native JSON.parse message.
            console.error('Claude JSON repair pass also failed:', secondError);
            throw new Error(
                'Claude returned content that could not be parsed as valid JSON, even after an automatic repair attempt. Try generating again — this is usually a one-off formatting slip.'
            );
        }
    }
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

        const parsed = parseBlogPostJson(cleaned);

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
