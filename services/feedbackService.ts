
import { AspectRatio } from '../types';
import { getSupabaseClient } from './supabaseClient';

export interface ImageFeedback {
    prompt: string;
    negative_prompt: string;
    aspect_ratio: AspectRatio;
    feedback: 'up' | 'down';
    created_at?: string;
}

export const fetchFeedback = async (): Promise<ImageFeedback[]> => {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('image_feedback')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);
            
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching feedback:', error);
        return [];
    }
};

export const saveImageFeedback = async (feedback: Omit<ImageFeedback, 'created_at'>) => {
    try {
        const supabase = getSupabaseClient();
        const { error } = await supabase
            .from('image_feedback')
            .insert([feedback]);
            
        if (error) throw error;
    } catch (error) {
        console.error('Error saving feedback to Supabase:', error);
    }
};

export const getPositiveFeedbackExamples = async (): Promise<string> => {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('image_feedback')
            .select('prompt')
            .eq('feedback', 'up')
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (error) throw error;
        if (!data || data.length === 0) return "";
        
        return data.map(f => `- "${f.prompt}" (SUCCESS)`).join('\n');
    } catch (error) {
        console.error('Error getting positive feedback:', error);
        return "";
    }
};

export const getNegativeFeedbackExamples = async (): Promise<string> => {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('image_feedback')
            .select('prompt')
            .eq('feedback', 'down')
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (error) throw error;
        if (!data || data.length === 0) return "";
        
        return data.map(f => `- "${f.prompt}" (AVOID THIS STYLE/COMPOSITION)`).join('\n');
    } catch (error) {
        console.error('Error getting negative feedback:', error);
        return "";
    }
};
