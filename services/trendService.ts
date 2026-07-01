
import { Type } from "@google/genai";

export interface TrendTopic {
    title: string;
    category: string;
    description: string;
    source: 'Insurance' | 'Weather' | 'Strategy';
    priority: number; // 1-10
}

/**
 * Uses Gemini with Google Search grounding to find the most relevant
 * insurance and weather trends for Ohio content strategy.
 *
 * Routed through the Netlify Function proxy — the Gemini API key never
 * reaches the browser.
 */
export const fetchIntelligentTrends = async (): Promise<TrendTopic[]> => {
    try {
        const res = await fetch('/.netlify/functions/gemini-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                params: {
                    model: "gemini-2.5-flash",
                    contents: "Search for and provide 15 currently trending insurance topics or weather-related insurance needs specific to Ohio and the national US market as of May 2026. Include seasonal needs (Spring/Summer), recent major weather events impacting claims, and hottest marketing strategy trends for insurance blogs (e.g. YouTube thumbnails, carousels).",
                    config: {
                        systemInstruction: "You are a content strategist for an independent insurance agency in Canal Winchester, Ohio. Your goal is to provide high-impact, timely, and relevant blog topics that will drive traffic and provide value to Ohio policyholders.",
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING, description: "Compelling blog title" },
                                    category: { type: Type.STRING, description: "Auto Insurance, Home Insurance, Business Insurance, General Insurance, or Claims" },
                                    description: { type: Type.STRING, description: "Brief overview of why this is trending" },
                                    source: { type: Type.STRING, enum: ["Insurance", "Weather", "Strategy"] },
                                    priority: { type: Type.NUMBER, description: "Importance score 1-10" }
                                },
                                required: ["title", "category", "description", "source", "priority"]
                            }
                        },
                        tools: [
                            { googleSearch: {} }
                        ]
                    }
                }
            }),
        });

        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `Trend fetch failed (${res.status})`);
        }

        const data = await res.json();
        if (!data.text) return [];
        return JSON.parse(data.text.trim()) as TrendTopic[];
    } catch (err) {
        console.error('Trend Intelligent Fetch Error:', err);
        // Return some static fallback "trends" if AI fails
        return [
            { title: "Ohio Spring Storm Season: Is Your Roof Ready?", category: "Home Insurance", description: "Spring storm patterns in Ohio", source: "Weather", priority: 9 },
            { title: "The Rise of EV Insurance in Columbus", category: "Auto Insurance", description: "Increase in EV adoption", source: "Insurance", priority: 7 },
            { title: "How to Use IG Carousels for Insurance Education", category: "General Insurance", description: "Social strategy focus", source: "Strategy", priority: 8 }
        ];
    }
};
