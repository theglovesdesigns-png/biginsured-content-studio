import { getSupabaseClient } from './supabaseClient';
import { Post } from '../types';
import { SUPABASE_CONFIG } from './config';

// Fetches a simplified list of posts for the dropdown
export const fetchPosts = async (): Promise<Post[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from(SUPABASE_CONFIG.POSTS_TABLE)
        .select('id, title, original_title, slug, category, status')
        .order('created_at', { ascending: false });

    if (error) {
        // Throw instead of silently swallowing — callers (like Content Audit)
        // need to know if this failed vs. genuinely returned 0 rows, since
        // an RLS policy or permissions issue looks identical to "no data"
        // otherwise and produces misleading counts in the UI.
        console.error('fetchPosts failed:', error.message, error);
        throw new Error(`Failed to fetch posts: ${error.message}`);
    }
    return data || [];
};

// Creates a new post and returns the new record
export const createPost = async (title: string, slug: string): Promise<Post> => {
    const supabase = getSupabaseClient();
    try {
        const { data, error } = await supabase
            .from(SUPABASE_CONFIG.POSTS_TABLE)
            .insert({ title, slug })
            .select('id, title, slug')
            .single();

        if (error) {
            throw new Error(`Failed to create post: ${error.message}`);
        }
        if (!data) {
            throw new Error("Post creation succeeded but no data was returned.");
        }
        return data;
    } catch (error) {
        console.warn("Error in createPost:", error);
        throw error;
    }
};

// Updates a post's featured_image_url
export const updatePostImageUrl = async (postId: number, imageUrl: string): Promise<void> => {
    const supabase = getSupabaseClient();
    try {
        const { error } = await supabase
            .from(SUPABASE_CONFIG.POSTS_TABLE)
            .update({ featured_image_url: imageUrl })
            .eq('id', postId);

        if (error) {
            throw new Error(`Failed to update post image URL: ${error.message}`);
        }
    } catch (error) {
        console.warn("Error in updatePostImageUrl:", error);
        throw error;
    }
};

/**
 * Upserts a full blog post with all SEO metadata.
 */
export const upsertBlogPost = async (post: any): Promise<void> => {
    const supabase = getSupabaseClient();
    try {
        const { error } = await supabase
            .from(SUPABASE_CONFIG.POSTS_TABLE)
            .upsert({
                title: post.title,
                slug: post.slug,
                category: post.category,
                content: post.content,
                excerpt: post.excerpt,
                meta_title: post.meta_title,
                meta_description: post.meta_description,
                tags_keywords: post.tags_keywords,
                estimated_word_count: post.estimated_word_count,
                author: post.author || 'Licensed Ohio Agent',
                status: post.status || 'Draft',
                hero_image_prompt: post.hero_image_prompt,
                hero_image_alt: post.hero_image_alt,
                updated_at: new Date().toISOString()
            }, { onConflict: 'slug' });

        if (error) throw error;
    } catch (error) {
        console.warn("Error in upsertBlogPost:", error);
        throw error;
    }
};
