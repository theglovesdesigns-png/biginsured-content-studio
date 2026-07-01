
import { getSupabaseClient } from './supabaseClient';
import { SUPABASE_CONFIG } from './config';

export interface PipelineItem {
    id?: string;
    title: string;
    category: string;
    best_posting_time: string;
    prompt: string;
    status: string;
    timestamp: string;
    created_at?: string;
}

const TABLE_NAME = SUPABASE_CONFIG.PIPELINE_TABLE;

/**
 * Persists a new item or updates an existing one in Supabase
 */
export const savePipelineItem = async (item: PipelineItem) => {
    const supabase = getSupabaseClient();
    
    // Safety mapping to ensure column names match the DB exactly
    const payload = {
        title: item.title,
        category: item.category,
        best_posting_time: item.best_posting_time,
        prompt: item.prompt,
        status: item.status,
        timestamp: item.timestamp,
    };

    const { data, error } = await supabase
        .from(TABLE_NAME)
        .upsert(payload, { onConflict: 'title' })
        .select();

    if (error) {
        console.warn('Supabase Save Error Details (Safe Warning):', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
        });
        throw error;
    }
    return data;
};

/**
 * Fetches all pipeline items from Supabase
 */
export const fetchPipelineItems = async (): Promise<PipelineItem[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.warn('Supabase Fetch Error (Safe Warning):', error);
        throw error;
    }
    return data || [];
};

/**
 * Updates only the status of an item
 */
export const updatePipelineStatus = async (title: string, newStatus: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase
        .from(TABLE_NAME)
        .update({ status: newStatus })
        .eq('title', title);

    if (error) {
        console.warn('Supabase Status Update Error (Safe Warning):', error);
        throw error;
    }
};

/**
 * Archives an item for record keeping when sent to Blog Builder
 */
export const archivePipelineItem = async (item: PipelineItem) => {
    const supabase = getSupabaseClient();
    const payload = {
        title: item.title,
        category: item.category,
        best_posting_time: item.best_posting_time,
        prompt: item.prompt,
        status: 'Sent to Blog Builder',
        timestamp: new Date().toISOString(),
        original_timestamp: item.timestamp
    };

    const { error } = await supabase
        .from(SUPABASE_CONFIG.PIPELINE_ARCHIVE_TABLE)
        .insert(payload);

    if (error) {
        console.warn('Supabase Archive Error (Safe Warning):', error);
        // We don't throw here to avoid blocking the user flow if archive fails
    }
};

/**
 * Deletes an item from the pipeline
 */
export const deletePipelineItem = async (title: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('title', title);

    if (error) {
        console.warn('Supabase Delete Error (Safe Warning):', error);
        throw error;
    }
};
