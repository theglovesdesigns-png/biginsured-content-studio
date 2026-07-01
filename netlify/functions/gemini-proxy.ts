// Netlify Function: Gemini API proxy
//
// This function runs on Netlify's server, NOT in the browser. The Gemini
// API key (GEMINI_API_KEY) is only ever read here, server-side, so it
// never appears in the JavaScript bundle that ships to the browser.
//
// The frontend (services/geminiService.ts) calls this function at
// /.netlify/functions/gemini-proxy instead of calling Google directly.

import type { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';

const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server.' }),
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { params } = body;

        if (!params || !params.model) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required "params.model" field.' }),
            };
        }

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent(params);

        // Extract everything the frontend might need: text output, and any
        // inline binary data (images, audio) from the first candidate's parts.
        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const inlineDataPart = parts.find((p: any) => p.inlineData);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: response.text,
                finishReason: candidate?.finishReason,
                inlineData: inlineDataPart?.inlineData || null,
            }),
        };
    } catch (error: any) {
        console.error('Gemini proxy error:', error);
        return {
            statusCode: error?.status || 500,
            body: JSON.stringify({
                error: error?.message || 'Unknown error calling Gemini API.',
            }),
        };
    }
};

export { handler };
