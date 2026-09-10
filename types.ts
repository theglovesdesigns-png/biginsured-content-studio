export type Tab = 'landing' | 'settings' | 'generate' | 'analyze' | 'upload' | 'gallery' | 'blog' | 'pipeline' | 'trends' | 'calendar' | 'auditor';

export type AspectRatio = 
  | '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:1' 
  | '1600x533' | '1920x600' | '1920x1080' // Website
  | '1080x1080' | '1080x1920' | '1200x630' | '1200x675' | '1200x900' // Social Essential
  | '1080x1350' | '1280x720' | '1500x500' | '1024x576'; // Social Optional

export interface ManagedFile {
  id: string;
  file: File;
  previewUrl: string | null;
  status: 'queued' | 'uploading' | 'resizing' | 'success' | 'error';
  progress: number;
  folder?: string;
  error?: string;
  publicUrl?: string;
}

export interface GalleryImage {
    id: number;
    created_at: string;
    prompt: string | null;
    negative_prompt: string | null;
    aspect_ratio: string | null;
    image_url: string | null;
}

export interface Post {
    id: number;
    title: string;
    slug: string;
    category?: string;
    status?: string;
    featured_image_url?: string;
}

export interface InlineImage {
    prompt: string;
    alt: string;
    caption: string;
    placement_note?: string; // e.g. "after the Ohio-specific section" — helps a human place it correctly
}

export interface BlogPost {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    category: "Home Insurance" | "Auto Insurance" | "Business Insurance" | "General Insurance" | "Claims";
    author: string;
    meta_title: string;
    meta_description: string;
    tags_keywords: string[];
    estimated_reading_time: string;
    estimated_word_count: number;
    status: string;
    inline_image_strategy: string;
    featured: boolean;
    locality: "Ohio" | "Central Ohio" | "National";

    // Hero image (always present)
    hero_image_prompt: string;
    hero_image_alt: string;
    hero_image_caption: string;

    // Inline body images — flexible count, chosen per article.
    // Replaces the old fixed inline_image_1/inline_image_2 fields below,
    // which are kept (optional) only so any code still reading them directly
    // doesn't break; new code should read from this array instead.
    inline_images: InlineImage[];

    /** @deprecated use inline_images[0] instead */
    inline_image_1_prompt?: string;
    /** @deprecated use inline_images[0] instead */
    inline_image_1_alt?: string;
    /** @deprecated use inline_images[0] instead */
    inline_image_1_caption?: string;

    /** @deprecated use inline_images[1] instead */
    inline_image_2_prompt?: string;
    /** @deprecated use inline_images[1] instead */
    inline_image_2_alt?: string;
    /** @deprecated use inline_images[1] instead */
    inline_image_2_caption?: string;

    // YouTube Thumbnail Strategy
    youtube_thumbnail_prompt: string;
    youtube_thumbnail_text: string;
    youtube_thumbnail_color: string;
    youtube_thumbnail_suggestions: string;
    pipeline_title?: string;
    pipeline_timestamp?: string;
}

export interface GeneratorPrompt {
    text: string;
    timestamp: number;
    metadata?: {
        slug: string;
        imageType: 'hero' | 'inline_1' | 'inline_2' | 'thumbnail';
    };
}

export interface SeriesPost {
    title: string;
    description: string;
    suggested_word_count: string;
    category: "Home Insurance" | "Auto Insurance" | "Business Insurance" | "General Insurance" | "Claims";
}

export interface BlogSeries {
    series_title: string;
    series_strategy: string;
    category: "Home Insurance" | "Auto Insurance" | "Business Insurance" | "General Insurance" | "Claims";
    posts: SeriesPost[];
    bonus_suggestions: SeriesPost[];
    total_posts: number;
}

// ── New two-stage series flow ──────────────────────────────────────────
// Stage 1 (cheap): generate 3-6 candidate outlines for review.
// Stage 2 (full cost): generate a complete BlogPost per outline the user
// actually approved. Keeps the old BlogSeries/SeriesPost types above intact
// for anything still referencing the older one-shot flow.

export interface SeriesOutlineItem {
    id: string; // stable id so the UI can track approve/reject per item across a re-render
    title: string;
    angle: string; // the specific angle/hook for this post, distinct from the others in the batch
    suggested_category: "Home Insurance" | "Auto Insurance" | "Business Insurance" | "General Insurance" | "Claims";
    suggested_locality: "Ohio" | "Central Ohio" | "National";
    one_line_pitch: string; // a sentence explaining why this angle is worth writing, for the human reviewing it
}

export interface SeriesOutline {
    series_title: string;
    series_strategy: string;
    items: SeriesOutlineItem[]; // 3-6 candidates
}
