import { Type } from "@google/genai";
import { AspectRatio, BlogPost, BlogSeries, SeriesPost } from '../types';
import { getPositiveFeedbackExamples, getNegativeFeedbackExamples } from './feedbackService';

// ============================================================
// GEMINI MODEL REGISTRY
// Updated June 2026 — always use these constants, never hardcode model names
// ============================================================
const MODELS = {
    PRO:          'gemini-2.5-pro',              // Deep reasoning, blog writing, series
    FLASH:        'gemini-2.5-flash',            // Fast tasks, analysis, trends
    IMAGE_GEN:    'gemini-2.5-flash-image', // Image generation
} as const;

// ============================================================
// SECURE PROXY CALL
// All Gemini requests route through this Netlify Function. The API key
// lives ONLY on the server (set as GEMINI_API_KEY in Netlify env vars)
// and is never bundled into the browser's JavaScript.
// ============================================================
interface ProxyResponse {
    text?: string;
    finishReason?: string;
    inlineData?: { data: string; mimeType: string } | null;
}

const callGeminiProxy = async (params: Record<string, unknown>): Promise<ProxyResponse> => {
    const res = await fetch('/.netlify/functions/gemini-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params }),
    });

    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Gemini proxy request failed (${res.status})`);
    }

    return res.json();
};

// ============================================================
// BLOG SERIES GENERATION
// ============================================================
export const generateBlogSeries = async (
    seriesTitle: string,
    seriesStrategy: string,
    targetVolume: number,
    wordCountRange: string,
    category: string
): Promise<BlogSeries> => {
    const systemPrompt = `You are a professional blog content strategist for Bradley Insurance Group (BIG), an independent insurance agency in Canal Winchester, Ohio.
    Your goal is to architect a multi-part blog series that builds long-term SEO authority on a specific insurance topic.

    SERIES ARCHITECTURE RULES:
    1. Create a logical progression of topics from introduction to advanced concepts.
    2. Each post must have a clear, unique angle that contributes to the overall series goal.
    3. WORD COUNT (CRITICAL): The target word count for EACH post in this series is ${wordCountRange} words.
    4. Provide "Bonus" suggestions: 2-4 additional high-value topics that would make the series even more definitive.
    5. CATEGORY: All posts in this series will be in the "${category}" category.

    BRADLEY INSURANCE GROUP VOICE:
    - Trustworthy, local neighbors (Canal Winchester/Columbus focus).
    - Educational first, professional but conversational.

    Output STRICTLY in JSON format. No markdown wrappers around the JSON.`;

    const userPrompt = `Series Master Title: ${seriesTitle}\nSeries Strategy: ${seriesStrategy}\nTarget Volume: ${targetVolume} posts`;

    try {
        const response = await callGeminiProxy({
            model: MODELS.PRO,
            contents: { parts: [{ text: userPrompt }] },
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        series_title: { type: Type.STRING },
                        series_strategy: { type: Type.STRING },
                        category: { type: Type.STRING, enum: ["Home Insurance", "Auto Insurance", "Business Insurance", "General Insurance", "Claims"] },
                        posts: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    suggested_word_count: { type: Type.STRING },
                                    category: { type: Type.STRING, enum: ["Home Insurance", "Auto Insurance", "Business Insurance", "General Insurance", "Claims"] }
                                },
                                required: ["title", "description", "suggested_word_count", "category"]
                            }
                        },
                        bonus_suggestions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    suggested_word_count: { type: Type.STRING },
                                    category: { type: Type.STRING, enum: ["Home Insurance", "Auto Insurance", "Business Insurance", "General Insurance", "Claims"] }
                                },
                                required: ["title", "description", "suggested_word_count", "category"]
                            }
                        },
                        total_posts: { type: Type.INTEGER }
                    },
                    required: ["series_title", "series_strategy", "category", "posts", "bonus_suggestions", "total_posts"]
                }
            }
        });
        return JSON.parse(response.text || '{}') as BlogSeries;
    } catch (error) {
        console.error("Series Generation Error:", error);
        throw error;
    }
};

// ============================================================
// IMAGE GENERATION
// ============================================================
export const generateImage = async (
    prompt: string,
    negativePrompt: string,
    aspectRatio: AspectRatio,
    isHighQuality: boolean,
    seed?: number
): Promise<string> => {
    try {
        let apiAspectRatio: string = '1:1';
        let compositionModifier = "";

        switch (aspectRatio) {
            case '1600x533':
            case '3:1':
            case '1920x600':
            case '1500x500':
                apiAspectRatio = '16:9';
                compositionModifier = "Ultra-wide cinematic panorama. Center subject with significant negative space on all sides. Subject MUST be fully contained within center 50% of frame to prevent cropping on wide displays.";
                break;
            case '1920x1080': case '16:9': case '1024x576': case '1200x630': case '1200x675': case '1280x720':
                apiAspectRatio = '16:9';
                compositionModifier = "Wide angle view. 15% safety margin on all sides. Subject must be entirely visible with clear space between subject and frame edges.";
                break;
            case '1080x1080': case '1:1':
                apiAspectRatio = '1:1';
                compositionModifier = "Centered full view. 10% empty padding around subject. Avoid any cropping of main focal point.";
                break;
            case '1200x900': case '4:3':
                apiAspectRatio = '4:3';
                compositionModifier = "Standard 4:3 photography. Center subject fully in frame with 15% margins from all edges.";
                break;
            case '1080x1350': case '3:4':
                apiAspectRatio = '3:4';
                compositionModifier = "Portrait 3:4. Fully contain subject. Do not cut off building tops or vehicle wheels. Generous padding all edges.";
                break;
            case '1080x1920': case '9:16':
                apiAspectRatio = '9:16';
                compositionModifier = "Vertical 9:16. Subject with clear breathing room from top and bottom frame edges.";
                break;
            default:
                apiAspectRatio = '1:1';
                break;
        }

        const baseNegative = "text, words, letters, font, watermark, logo, brand, sign, website, signature, person, people, human, face, distorted, blur, blurry, low-res, grainy, borders, frames, ui, buttons, interface, cut off subject, cropped head, cropped limbs, out of frame, partial object, partial vehicle, partial building, wheels cut off, roof cut off, plastic texture, synthetic look, over-saturated colors, floating objects, disconnected limbs";
        const combinedNegative = negativePrompt.trim() ? `${baseNegative}, ${negativePrompt}` : baseNegative;

        // Learning engine: inject feedback from user's thumbs up/down history
        const positiveExamples = await getPositiveFeedbackExamples();
        const negativeExamples = await getNegativeFeedbackExamples();
        let learningContext = "";
        if (positiveExamples) {
            learningContext += `\n[USER PREFERENCES - LIKED STYLES]:\n${positiveExamples}`;
        }
        if (negativeExamples) {
            learningContext += `\n[USER PREFERENCES - AVOID THESE]:\n${negativeExamples}`;
        }

        // ── Smart style detection ──────────────────────────────────────────
        let styleModifier = "Professional commercial photography, 35mm lens, f/2.8, natural lighting, high dynamic range, authentic textures, realistic depth of field, crisp sharp focus throughout.";
        const lowerPrompt = prompt.toLowerCase();
        const styleKeywords = ['futuristic', 'cyberpunk', 'hyper-realistic', 'cinematic', 'vintage', 'analog', 'oil painting', 'sketch', '3d render', 'isometric', 'minimalist', 'brutalist', 'noir', 'vaporwave', 'surreal'];
        const detectedStyle = styleKeywords.find(k => lowerPrompt.includes(k));
        if (detectedStyle) {
            styleModifier = `Award-winning ${detectedStyle} aesthetic, high-end professional visual execution, crisp sharp focus.`;
        }

        // ── Subject-specific framing rules ────────────────────────────────
        // Detects the likely subject type from the prompt and injects targeted
        // framing instructions. This is the primary fix for cut-off subjects —
        // generic "show full subject" instructions are frequently ignored, but
        // subject-specific rules ("all four wheels touching ground") are not.
        let subjectFramingRule = "Show the COMPLETE main subject with NO cropping of any part. Leave generous empty space (at least 15%) between the subject and every edge of the frame.";

        const vehicleWords = ['car', 'truck', 'suv', 'vehicle', 'automobile', 'van', 'pickup', 'sedan', 'coupe', 'jeep', 'motorcycle', 'bike', 'bus'];
        const buildingWords = ['house', 'home', 'building', 'office', 'structure', 'property', 'roof', 'garage', 'warehouse', 'storefront', 'church', 'school'];
        const personWords = ['person', 'man', 'woman', 'family', 'couple', 'child', 'people', 'agent', 'worker', 'contractor'];
        const animalWords = ['dog', 'cat', 'pet', 'animal', 'bird'];

        const isVehicle   = vehicleWords.some(w => lowerPrompt.includes(w));
        const isBuilding  = buildingWords.some(w => lowerPrompt.includes(w));
        const isPerson    = personWords.some(w => lowerPrompt.includes(w));
        const isAnimal    = animalWords.some(w => lowerPrompt.includes(w));

        if (isVehicle) {
            subjectFramingRule = "VEHICLE FRAMING RULES (non-negotiable): Show the COMPLETE vehicle from front bumper to rear bumper. All four wheels must be fully visible and touching the ground — do NOT cut off wheels at the bottom. The full roofline must be visible with clear space above it. Hood, trunk, and all body panels must be fully in frame. Leave 15-20% empty space on all sides beyond the vehicle.";
        } else if (isBuilding) {
            subjectFramingRule = "BUILDING FRAMING RULES (non-negotiable): Show the COMPLETE structure from roofline peak to foundation/ground level. The full width of the building must be visible including all sides shown. Roof, walls, windows, doors, and foundation all fully visible. Include surrounding yard or landscape context. Leave 15% empty space above the roofline and on all sides.";
        } else if (isPerson) {
            subjectFramingRule = "PERSON FRAMING RULES (non-negotiable): Show the person's COMPLETE body from head to toe with NO cropping at any body part. Head fully visible with space above. Feet fully visible with space below. Hands fully visible at sides. Leave 15% breathing room on all sides beyond the person.";
        } else if (isAnimal) {
            subjectFramingRule = "ANIMAL FRAMING RULES (non-negotiable): Show the COMPLETE animal including head, body, tail, and all four legs/paws fully visible. No cropping of any body part. Leave 15% empty space on all sides.";
        }

        // ── Quality enforcement block (applies every generation) ───────────
        // Previously only applied in "High Quality" mode and was a single weak
        // sentence. Now always applied as a structured block since quality
        // should never be optional — isHighQuality adds extra detail on top.
        const qualityBlock = `
QUALITY REQUIREMENTS (mandatory every generation):
- Photorealistic rendering with authentic real-world lighting
- Sharp focus on the main subject with natural depth of field
- True-to-life color grading — no over-saturation, no artificial filters
- Fine surface detail: textures, materials, reflections rendered accurately
- Professional exposure: well-lit, no blown-out highlights, no crushed shadows
- Clean edges on all objects — no bleeding, haloing, or artifacting${isHighQuality ? `
- ENHANCED QUALITY MODE: Maximum micro-detail resolution, ultra-fine textures, professional-grade color science, studio-quality output` : ''}`;

        // ── Final prompt assembly — framing rules come FIRST ──────────────
        // Order matters: Gemini weights earlier instructions more heavily.
        // Subject framing and safety zone rules MUST lead the prompt so they
        // aren't overridden by style/content instructions that follow.
        const exclusionSentence = `HARD EXCLUSIONS (never include): NO text, NO signs, NO watermarks, NO logos, NO watermarks anywhere. Avoid all of: ${combinedNegative}.`;

        const finalPrompt = `[CRITICAL FRAMING RULES — READ FIRST]:
${subjectFramingRule}
SAFE ZONE RULE: Keep the main subject entirely within the CENTER 70% of the frame. The outer 15% on all four edges must be empty negative space or background only — never the subject or any part of it.
ASPECT RATIO NOTE: This image will be displayed at ${apiAspectRatio} — compose specifically for this ratio with the subject safely inside the frame.

[SCENE DESCRIPTION]:
${prompt.trim()}

[EXECUTION STYLE]:
${styleModifier}
Composition framing: ${compositionModifier}${learningContext}

${qualityBlock}

${exclusionSentence}`;

        const response = await callGeminiProxy({
            model: MODELS.IMAGE_GEN,
            contents: { parts: [{ text: finalPrompt }] },
            config: {
                responseModalities: ['IMAGE', 'TEXT'],
                generationConfig: {
                    imageGenerationConfig: {
                        numberOfImages: 1,
                        aspectRatio: apiAspectRatio,
                    }
                }
            }
        });

        if (response.inlineData?.data) return response.inlineData.data;

        if (response.finishReason === 'SAFETY') {
            throw new Error("Generation blocked by safety filters. Try rephrasing your prompt to be more neutral and descriptive.");
        }
        throw new Error(`Generation failed (Reason: ${response.finishReason || 'Unknown'}). Try a different prompt.`);

    } catch (error: any) {
        console.error("Image Gen Error:", error);

        if (error.message?.includes('429') || error.status === 429 || error.message?.includes('RESOURCE_EXHAUSTED')) {
            throw new Error("Quota exceeded (429). Please wait 1-2 minutes before trying again.");
        }
        if (error.message?.includes('SAFETY')) {
            throw new Error("Blocked by safety filters. Try a more general description without specific names or sensitive topics.");
        }

        throw error;
    }
};

// ============================================================
// IMAGE EDITING
// ============================================================
export const editImage = async (base64ImageData: string, mimeType: string, prompt: string): Promise<string> => {
    try {
        const hyperFocusedPrompt = `[IMAGE MODIFICATION - NO TEXT/LOGOS]. ${prompt}. Maintain original lighting and style perfectly.`;
        const response = await callGeminiProxy({
            model: MODELS.IMAGE_GEN,
            contents: {
                parts: [
                    { inlineData: { data: base64ImageData, mimeType } },
                    { text: hyperFocusedPrompt }
                ]
            },
            config: {
                responseModalities: ['IMAGE', 'TEXT'],
            }
        });
        if (response.inlineData?.data) return response.inlineData.data;
        throw new Error("Edit failed — no image returned.");
    } catch (error) {
        throw error;
    }
};

// ============================================================
// IMAGE ANALYSIS
// ============================================================
export const analyzeImage = async (base64ImageData: string, mimeType: string, prompt: string): Promise<string> => {
    try {
        const response = await callGeminiProxy({
            model: MODELS.FLASH,
            contents: {
                parts: [
                    { inlineData: { data: base64ImageData, mimeType } },
                    { text: prompt }
                ]
            }
        });
        return response.text || '';
    } catch (error) {
        throw error;
    }
};

// ============================================================
// BLOG POST GENERATION
// ============================================================
export const generateBlogPost = async (
    titleIdea: string,
    description: string,
    wordCountRange: string,
    selectedCategory?: string
): Promise<BlogPost> => {
    const categoryInstruction = selectedCategory
        ? `The category MUST be "${selectedCategory}".`
        : `Choose the most appropriate from: ["Home Insurance", "Auto Insurance", "Business Insurance", "General Insurance", "Claims"].`;

    const systemPrompt = `You are a professional blog content writer AND visual content strategist for Bradley Insurance Group (BIG), an independent insurance agency in Canal Winchester, Ohio.
    You write SEO-optimized, informative blog articles about insurance topics for Ohio families and small businesses.

    CATEGORY SELECTION: ${categoryInstruction}

    WORD COUNT ADHERENCE (CRITICAL):
    - You MUST strictly adhere to the "${wordCountRange}" word count range.
    - Expand with practical examples, local Ohio context, and detailed insurance explanations to meet the target without fluff.

    EDITORIAL INTEGRITY (MANDATORY):
    - TRUTH & FACTS ONLY. All information must be factual and objective.
    - NEUTRALITY: No political opinions, no slanting, no bias.
    - If there is conflicting information on a topic, include: "This topic involves complex or differing information and requires review by a qualified professional."
    - NO OPINIONS. Stick strictly to verifiable facts.

    BRADLEY INSURANCE GROUP VOICE:
    - Trustworthy, local neighbors (Canal Winchester/Columbus focus).
    - Educational first, professional but conversational. Use "you" and "your".

    CONTENT FORMAT (MANDATORY):
    - Output "content" in STRICT MARKDOWN format.
    - Use ## for main section headers, ### for subsections.
    - Use **bold** for key insurance terms on first use.
    - Use bulleted lists for takeaways or tips.
    - Article structure: Hook, Intro, 4-6 Main Sections, Practical Examples, Conclusion, CTA.

    IMAGE PROMPTS:
    Generate THREE completely DIFFERENT visual prompts (Hero, Inline 1, Inline 2).
    - Describe core subject with detail on physical features, materials, textures.
    - Include atmosphere/mood (e.g., "golden hour", "moody storm clouds").
    - Keep focused and clear (50-70 words). Do NOT over-complicate.
    - MANDATORY: "Full centered view with wide field of vision" and "Ample empty space around subject".
    - Ohio-specific details (local flora, Midwest neighborhood architecture).
    - NO TEXT, NO LOGOS, NO WATERMARKS, NO SIGNS WITH TEXT.

    YOUTUBE THUMBNAIL STRATEGY:
    - youtube_thumbnail_prompt: Striking background image prompt (NO people, faces, or text — pure environment/objects).
    - youtube_thumbnail_text: Short, punchy overlay text (click-worthy but professional).
    - youtube_thumbnail_color: Recommended text color (e.g., "Vibrant Yellow").
    - youtube_thumbnail_suggestions: 2-3 specific CTR tips.

    Output STRICTLY in JSON. No markdown wrappers around the JSON.`;

    const userPrompt = `Topic Idea: ${titleIdea}\nDetails: ${description}\nTarget Word Count: ${wordCountRange}`;

    try {
        const response = await callGeminiProxy({
            model: MODELS.PRO,
            contents: { parts: [{ text: userPrompt }] },
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        slug: { type: Type.STRING },
                        excerpt: { type: Type.STRING },
                        content: { type: Type.STRING, description: "Full blog post in strict Markdown." },
                        category: { type: Type.STRING, enum: ["Home Insurance", "Auto Insurance", "Business Insurance", "General Insurance", "Claims"] },
                        author: { type: Type.STRING },
                        meta_title: { type: Type.STRING },
                        meta_description: { type: Type.STRING },
                        tags_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                        estimated_reading_time: { type: Type.STRING },
                        estimated_word_count: { type: Type.INTEGER },
                        status: { type: Type.STRING },
                        inline_image_strategy: { type: Type.STRING },
                        featured: { type: Type.BOOLEAN },
                        hero_image_prompt: { type: Type.STRING },
                        hero_image_alt: { type: Type.STRING },
                        hero_image_caption: { type: Type.STRING },
                        inline_image_1_prompt: { type: Type.STRING },
                        inline_image_1_alt: { type: Type.STRING },
                        inline_image_1_caption: { type: Type.STRING },
                        inline_image_2_prompt: { type: Type.STRING },
                        inline_image_2_alt: { type: Type.STRING },
                        inline_image_2_caption: { type: Type.STRING },
                        youtube_thumbnail_prompt: { type: Type.STRING },
                        youtube_thumbnail_text: { type: Type.STRING },
                        youtube_thumbnail_color: { type: Type.STRING },
                        youtube_thumbnail_suggestions: { type: Type.STRING }
                    },
                    required: ["title", "slug", "excerpt", "content", "category", "hero_image_prompt", "inline_image_1_prompt", "inline_image_2_prompt", "youtube_thumbnail_prompt", "youtube_thumbnail_text", "youtube_thumbnail_color", "youtube_thumbnail_suggestions"]
                }
            }
        });
        return JSON.parse(response.text || '{}') as BlogPost;
    } catch (error) {
        console.error("Blog Generation Error:", error);
        throw error;
    }
};
