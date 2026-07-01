
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './config';

let supabaseInstance: SupabaseClient | null = null;

const SUPABASE_URL_KEY = 'supabase.url';
const SUPABASE_ANON_KEY_KEY = 'supabase.anonKey';

function isValidUrl(url: string | undefined | null): boolean {
    if (!url || typeof url !== 'string') return false;
    try {
        const u = new URL(url);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

const safeCreateClient = (url: string, key: string): SupabaseClient => {
    return createClient(url, key, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: typeof window !== 'undefined' ? window.localStorage : undefined
        }
    });
};

function initClient(): SupabaseClient | null {
    // Check if configured (Priority is handled in config.ts)
    if (isValidUrl(SUPABASE_CONFIG.SUPABASE_URL) && SUPABASE_CONFIG.SUPABASE_ANON_KEY?.trim()) {
        try {
            return safeCreateClient(SUPABASE_CONFIG.SUPABASE_URL.trim(), SUPABASE_CONFIG.SUPABASE_ANON_KEY.trim());
        } catch (e) {
            console.error("Supabase connection failed.");
        }
    }

    // Fallback to Local storage if config is missing
    try {
        const storedUrl = localStorage.getItem(SUPABASE_URL_KEY);
        const storedKey = localStorage.getItem(SUPABASE_ANON_KEY_KEY);
        if (isValidUrl(storedUrl) && storedKey && storedUrl !== 'null' && storedUrl !== '') {
            return safeCreateClient(storedUrl!, storedKey!);
        }
    } catch (e) {
        // Silent
    }
    
    return null;
}

export function getSupabaseClient(): SupabaseClient {
    if (!supabaseInstance) {
        supabaseInstance = initClient();
    }
    
    if (!supabaseInstance) {
        throw new Error('SYSTEM_NOT_CONFIGURED');
    }
    
    return supabaseInstance;
}

export function isSupabaseConfigured(): boolean {
    // Check Config File
    if (isValidUrl(SUPABASE_CONFIG.SUPABASE_URL) && SUPABASE_CONFIG.SUPABASE_ANON_KEY?.trim()) return true;

    // Check Env
    if (typeof process !== 'undefined' && process.env) {
        if (isValidUrl(process.env.SUPABASE_URL) && process.env.SUPABASE_ANON_KEY) return true;
    }

    // Check Storage
    try {
        const storedUrl = localStorage.getItem(SUPABASE_URL_KEY);
        const storedKey = localStorage.getItem(SUPABASE_ANON_KEY_KEY);
        return (isValidUrl(storedUrl) && !!storedKey && storedUrl !== 'null' && storedUrl !== '');
    } catch (e) {
        return false;
    }
}

export function initializeSupabase(url: string, anonKey: string): void {
    const newClient = safeCreateClient(url, anonKey);
    supabaseInstance = newClient;
    localStorage.setItem(SUPABASE_URL_KEY, url);
    localStorage.setItem(SUPABASE_ANON_KEY_KEY, anonKey);
}

export function clearSupabaseCredentials(): void {
    localStorage.removeItem(SUPABASE_URL_KEY);
    localStorage.removeItem(SUPABASE_ANON_KEY_KEY);
    supabaseInstance = null;
    window.location.reload();
}
