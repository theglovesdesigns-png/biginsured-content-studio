// Netlify Function: Claude API proxy
//
// This function runs on Netlify's server, NOT in the browser. The Claude
// API key (ANTHROPIC_API_KEY) is only ever read here, server-side, so it
// never appears in the JavaScript bundle that ships to the browser.
//
// The frontend (services/claudeService.ts) calls this function at
// /.netlify/functions/claude-proxy instead of calling Anthropic directly.
//
// This mirrors gemini-proxy.ts on purpose: same shape, same error handling,
// so anyone reading one understands the other.

import type { Handler } from '@netlify/functions';

// Claude's Messages API — no SDK needed, plain fetch is enough and keeps
// this function's dependencies minimal.
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured on the server.' }),
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { params } = body;

        if (!params || !params.model || !params.messages) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required "params.model" or "params.messages" field.' }),
            };
        }

        // max_tokens is required by Claude's API — default it if the caller
        // forgot, rather than letting the request fail with a vague 400.
        const requestBody = {
            max_tokens: 4096,
            ...params,
        };

        const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': ANTHROPIC_VERSION,
                'content-type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        const data = await anthropicResponse.json();

        if (!anthropicResponse.ok) {
            console.error('Claude API error:', data);
            return {
                statusCode: anthropicResponse.status,
                body: JSON.stringify({
                    error: data?.error?.message || 'Unknown error calling Claude API.',
                }),
            };
        }

        // Claude's response content is an array of blocks (text, tool_use,
        // etc). Extract combined text the same simple way gemini-proxy.ts
        // extracts `.text`, so the frontend service layer can treat both
        // proxies the same way.
        const textContent = (data.content || [])
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('');

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: textContent,
                stopReason: data.stop_reason,
                usage: data.usage,
            }),
        };
    } catch (error: any) {
        console.error('Claude proxy error:', error);
        return {
            statusCode: error?.status || 500,
            body: JSON.stringify({
                error: error?.message || 'Unknown error calling Claude API.',
            }),
        };
    }
};

export { handler };
