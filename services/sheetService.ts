
import { BlogPost } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Sends the blog post data to a Google Apps Script Webhook.
 */
export const sendBlogToSheet = async (webhookUrl: string, blogPost: BlogPost): Promise<void> => {
    
    // Robust date calculation for schedule logic
    const now = new Date();
    const formattedDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const forcedPublishTimestamp = `${formattedDate} 16:00:00+00`;

    // Format tags as {"tag1","tag2"} for Google Sheets/Supabase sync
    const formattedTags = `{${blogPost.tags_keywords.map(tag => `"${tag}"`).join(',')}}`;

    const payload = {
        type: 'port_to_schedule',
        appSource: 'BigInsured_Studio',
        id: uuidv4(),
        title: blogPost.title,
        excerpt: blogPost.excerpt,
        content: blogPost.content,
        category: blogPost.category,
        image_url: '', // Will be updated manually or via subsequent step
        author: blogPost.author || 'Licensed Ohio Agent',
        tags_keywords: formattedTags,
        slug: blogPost.slug,
        meta_title: blogPost.meta_title,
        meta_description: blogPost.meta_description,
        publish_at_time: forcedPublishTimestamp,
        word_count: blogPost.estimated_word_count,
        status: 'Draft',
        // Pipeline identifiers (extra, won't hurt)
        pipeline_title: blogPost.pipeline_title, 
        pipeline_timestamp: blogPost.pipeline_timestamp
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors', 
            cache: 'no-cache',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', 
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        // With mode: 'no-cors', we get an opaque response. 
        // If fetch didn't throw, the request was successfully dispatched.
        console.log("Sheet dispatch completed (Opaque Response)");
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error("Sheet Sync Timeout (30s reached)");
            throw new Error("Sync timed out (Google Sheets took too long), but data might still arrive.");
        }
        console.error("Sheet Sync Error:", error);
        throw new Error(`Sheet Sync Failed: ${error instanceof Error ? error.message : 'Connection failed'}`);
    } finally {
        clearTimeout(timeoutId);
    }
};
