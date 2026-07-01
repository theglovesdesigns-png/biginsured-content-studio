
/**
 * OFFICE CONFIGURATION CENTER
 * 
 * To make the app "just work" for your staff without asking for URLs or Keys:
 * 1. Fill in the SUPABASE_URL and SUPABASE_ANON_KEY below.
 * 2. Once these are filled, the Technical Setup screen is HIDDEN.
 * 3. Staff will only see a standard Email/Password Login.
 */
export const SUPABASE_CONFIG = {
    // === PROJECT CONNECTION (Hardcode these to skip technical setup) ===
    // Priority: Environment Variables > Hardcoded Config
    SUPABASE_URL: (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL) || 'https://yoqgyrdjcmmkcbhymwdn.supabase.co', 
    SUPABASE_ANON_KEY: (typeof process !== 'undefined' && process.env && process.env.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvcWd5cmRqY21ta2NiaHltd2RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMDQwMjcsImV4cCI6MjA3Mzg4MDAyN30.eFUQrLf9WGUC3WRb3pvProkiVWwUlyR7Id-ojQG9E_M',

    // === GOOGLE SHEETS CONNECTION ===
    GOOGLE_SHEETS_WEBHOOK_URL: (typeof process !== 'undefined' && process.env && process.env.GOOGLE_SHEETS_WEBHOOK_URL) || 'https://script.google.com/macros/s/AKfycbz94xQn4p9r5E9B7w8rohSz31xawz5_2N6lB5goXXZKuRwwjpnNpTMUbSdLlu6edQ5xMg/exec',

    // === STORAGE BUCKETS ===
    IMAGES_BUCKET: 'blog-images',
    GALLERY_BUCKET: 'ai-gallery',

    // === DATABASE TABLES ===
    GALLERY_TABLE: 'images',
    POSTS_TABLE: 'blog_posts',
    PIPELINE_TABLE: 'pipeline_items',
    PIPELINE_ARCHIVE_TABLE: 'pipeline_archives',
    AUDIT_LOG_TABLE: 'audit_log',
};
