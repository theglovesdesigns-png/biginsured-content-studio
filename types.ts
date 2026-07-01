
export type Tab = 'landing' | 'settings' | 'generate' | 'analyze' | 'upload' | 'gallery' | 'blog' | 'voiceover' | 'pipeline' | 'trends' | 'calendar' | 'auditor';

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
    
    // 3-Image Strategy
    hero_image_prompt: string;
    hero_image_alt: string;
    hero_image_caption: string;
    
    inline_image_1_prompt: string;
    inline_image_1_alt: string;
    inline_image_1_caption: string;
    
    inline_image_2_prompt: string;
    inline_image_2_alt: string;
    inline_image_2_caption: string;

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
