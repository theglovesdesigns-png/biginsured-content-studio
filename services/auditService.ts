
import { getSupabaseClient } from './supabaseClient';
import { SUPABASE_CONFIG } from './config';

export interface AuditItem {
    id: string;
    title: string;
    category: string;
    source: 'Ideas Tab' | 'Blog Schedule' | 'Live Website';
    status?: string;
    rowRef?: string;
    rowNumber?: number; // actual spreadsheet row, only set for Ideas Tab items — required for safe deletion
}

export interface DuplicatePair {
    itemA: AuditItem;
    itemB: AuditItem;
    similarity: number; // 0-100
    matchType: 'Exact' | 'Near-Exact' | 'Similar';
}

export interface AuditLogEntry {
    id?: string;
    run_at: string;
    ideas_count: number;
    schedule_count: number;
    website_count: number;
    duplicates_found: number;
    notes?: string;
}

// ============================================================
// TITLE NORMALIZATION — strips punctuation/casing so "Buckeye
// Lake Ready?" and "buckeye lake ready" are recognized as the same.
// ============================================================
const normalize = (title: string): string => {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ');
};

// ============================================================
// LEVENSHTEIN-BASED SIMILARITY (0-100)
// Pure JS, no API calls, instant — runs entirely in the browser.
// ============================================================
const similarity = (a: string, b: string): number => {
    const s1 = normalize(a);
    const s2 = normalize(b);
    if (s1 === s2) return 100;
    if (!s1.length || !s2.length) return 0;

    const matrix: number[][] = Array.from({ length: s1.length + 1 }, () =>
        new Array(s2.length + 1).fill(0)
    );
    for (let i = 0; i <= s1.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= s1.length; i++) {
        for (let j = 1; j <= s2.length; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    const distance = matrix[s1.length][s2.length];
    const maxLen = Math.max(s1.length, s2.length);
    return Math.round((1 - distance / maxLen) * 100);
};

/**
 * Scans ALL items (across Ideas, Schedule, Website combined) and finds
 * every pair that's an exact or near-exact title match — regardless of
 * which source(s) they're in. This is what catches:
 *   - The same title published twice (Schedule duplicate)
 *   - An idea that's already live on the website
 *   - An idea that's already scheduled
 *   - Two ideas that are basically the same topic
 *
 * Runs instantly client-side — no API key, no tokens, no cost.
 */
export const findDuplicates = (items: AuditItem[], threshold = 85): DuplicatePair[] => {
    const pairs: DuplicatePair[] = [];
    const valid = items.filter(i => i.title && i.title.trim().length > 3);

    for (let i = 0; i < valid.length; i++) {
        for (let j = i + 1; j < valid.length; j++) {
            const a = valid[i];
            const b = valid[j];

            // Skip comparing an item to itself in the same source/row
            if (a.id === b.id) continue;

            const score = similarity(a.title, b.title);
            if (score >= threshold) {
                pairs.push({
                    itemA: a,
                    itemB: b,
                    similarity: score,
                    matchType: score === 100 ? 'Exact' : score >= 92 ? 'Near-Exact' : 'Similar',
                });
            }
        }
    }

    // Sort highest similarity first, exact duplicates surface immediately
    return pairs.sort((x, y) => y.similarity - x.similarity);
};

// ============================================================
// AUDIT LOG — persisted to Supabase so "when was this last
// checked" is never something you have to remember.
// ============================================================
export const logAuditRun = async (entry: Omit<AuditLogEntry, 'run_at'>): Promise<void> => {
    try {
        const supabase = getSupabaseClient();
        await supabase.from(SUPABASE_CONFIG.AUDIT_LOG_TABLE).insert({
            run_at: new Date().toISOString(),
            ...entry,
        });
    } catch (error) {
        // Non-fatal — the audit itself still ran and showed results,
        // logging the run is a nice-to-have, not a blocker.
        console.error('Failed to save audit log entry:', error);
    }
};

export const getLatestAuditRun = async (): Promise<AuditLogEntry | null> => {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from(SUPABASE_CONFIG.AUDIT_LOG_TABLE)
            .select('*')
            .order('run_at', { ascending: false })
            .limit(1)
            .single();

        if (error) return null;
        return data as AuditLogEntry;
    } catch {
        return null;
    }
};

export const getAuditHistory = async (limit = 10): Promise<AuditLogEntry[]> => {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from(SUPABASE_CONFIG.AUDIT_LOG_TABLE)
            .select('*')
            .order('run_at', { ascending: false })
            .limit(limit);

        if (error) return [];
        return (data as AuditLogEntry[]) || [];
    } catch {
        return [];
    }
};
