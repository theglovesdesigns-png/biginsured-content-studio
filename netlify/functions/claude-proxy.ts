// Netlify Function: Claude API proxy (STREAMING)
//
// This function runs on Netlify's server, NOT in the browser. The Claude
// API key (ANTHROPIC_API_KEY) is only ever read here, server-side, so it
// never appears in the JavaScript bundle that ships to the browser.
//
// WHY THIS IS STREAMING (changed 9/14/2026):
// A full-length blog article (1,800-2,200+ words) can take Claude longer
// to generate than Netlify's buffered-function timeout allows (max ~26
// seconds even on paid plans). The original version of this file waited
// for the ENTIRE response before sending anything back, which caused
// long article generations to fail with a 504 "request timed out" error.
//
// Streaming fixes this: instead of waiting for Claude to finish, this
// function forwards each piece of text to the browser as Claude writes
// it. As long as new data keeps arriving, the connection stays alive —
// there's no more "wait 30+ seconds for one big response" step to time
// out. This matches Netlify's own documented pattern for streaming an
// AI API's response straight through: https://docs.netlify.com/functions/get-started
//
// IMPORTANT — this uses Netlify's newer streaming-capable function
// format (a default-exported function receiving a standard Request and
// returning a standard Response), NOT the older `Handler` type the rest
// of this project's functions (gemini-proxy.ts) still use. That older
// format cannot stream — it always waits for the whole response before
// replying, which is exactly the problem this file exists to fix.
// gemini-proxy.ts is untouched and still works fine as-is for its
// shorter-running calls.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export default async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured on the server.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    let params: Record<string, unknown>;
    try {
        const body = await req.json();
        params = body.params;
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON request body.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    if (!params || !params.model || !params.messages) {
        return new Response(
            JSON.stringify({ error: 'Missing required "params.model" or "params.messages" field.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Always request streaming from Claude itself — this is what lets us
    // forward data as it arrives instead of buffering the whole thing.
    const requestBody = {
        max_tokens: 4096,
        ...params,
        stream: true,
    };

    let anthropicResponse: Response;
    try {
        anthropicResponse = await fetch(ANTHROPIC_API_URL, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': ANTHROPIC_VERSION,
                'content-type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
    } catch (error: any) {
        console.error('Claude proxy — network error calling Anthropic:', error);
        return new Response(
            JSON.stringify({ error: error?.message || 'Network error calling Claude API.' }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
    }

    if (!anthropicResponse.ok || !anthropicResponse.body) {
        // Anthropic returned an error — read it as JSON (not a stream) and
        // pass the real error message back rather than a generic one.
        const errData = await anthropicResponse.json().catch(() => ({}));
        console.error('Claude API error:', errData);
        return new Response(
            JSON.stringify({ error: errData?.error?.message || 'Unknown error calling Claude API.' }),
            { status: anthropicResponse.status || 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Anthropic's stream sends Server-Sent Events. We read those events,
    // pull out just the actual text as it's generated, and re-package
    // each piece as our own small JSON line — so the frontend doesn't
    // need to understand Anthropic's SSE event format at all, only ours.
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = anthropicResponse.body.getReader();

    const stream = new ReadableStream({
        async start(controller) {
            let buffer = '';
            let finalStopReason: string | null = null;
            let finalUsage: unknown = null;

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // keep the last, possibly-incomplete line for next time

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const jsonStr = line.slice(6).trim();
                        if (!jsonStr) continue;

                        let event: any;
                        try {
                            event = JSON.parse(jsonStr);
                        } catch {
                            continue; // skip any malformed line rather than crashing the whole stream
                        }

                        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                            // Forward just the new text chunk to the browser.
                            const chunk = { textDelta: event.delta.text as string };
                            controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
                        } else if (event.type === 'message_delta') {
                            finalStopReason = event.delta?.stop_reason ?? finalStopReason;
                            finalUsage = event.usage ?? finalUsage;
                        }
                    }
                }

                // Send one final line with metadata, so the frontend knows
                // the stream is complete and can see stop_reason/usage.
                controller.enqueue(
                    encoder.encode(
                        JSON.stringify({ done: true, stopReason: finalStopReason, usage: finalUsage }) + '\n'
                    )
                );
                controller.close();
            } catch (error: any) {
                console.error('Claude proxy — error while streaming:', error);
                controller.enqueue(
                    encoder.encode(JSON.stringify({ error: error?.message || 'Stream error.' }) + '\n')
                );
                controller.close();
            }
        },
    });

    return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'application/x-ndjson' },
    });
};
