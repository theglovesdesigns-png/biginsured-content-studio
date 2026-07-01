
import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AspectRatio } from '../types';
import { getSupabaseClient } from '../services/supabaseClient';

const MAX_HISTORY = 10;
const SESSION_ID_KEY = 'generator.session_id';

const getSessionId = (): string => {
    let sessionId = localStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
        sessionId = uuidv4();
        localStorage.setItem(SESSION_ID_KEY, sessionId);
    }
    return sessionId;
};

const getInitialState = <T>(key: string, defaultValue: T): T => {
    try {
        const item = window.localStorage.getItem(key);
        if ((key === 'generator.aspectRatios' || key === 'generator.promptHistory' || key === 'generator.selectedSnippets') && (!item || !Array.isArray(JSON.parse(item)))) {
            return defaultValue;
        }
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.warn(`Error reading localStorage key "${key}":`, error);
        return defaultValue;
    }
};

const saveState = <T>(key: string, value: T) => {
     try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
    }
};

export const useGeneratorSettings = () => {
    const sessionId = getSessionId();
    const [prompt, setPrompt] = useState<string>(
        getInitialState('generator.prompt', '')
    );
    const [negativePrompt, setNegativePrompt] = useState<string>(
        getInitialState('generator.negativePrompt', 'text, watermark, ugly, blurry, deformed')
    );
    const [aspectRatios, setAspectRatios] = useState<AspectRatio[]>(
        getInitialState<AspectRatio[]>('generator.aspectRatios', ['16:9'])
    );
    const [selectedSnippets, setSelectedSnippets] = useState<string[]>(
        getInitialState<string[]>('generator.selectedSnippets', [])
    );
    
    const [isHighQuality, setIsHighQuality] = useState<boolean>(false);
    const [promptHistory, setPromptHistory] = useState<string[]>(
        getInitialState<string[]>('generator.promptHistory', [])
    );

    const isInitialLoad = useRef(true);

    // Load from Supabase on mount
    useEffect(() => {
        const loadFromSupabase = async () => {
            try {
                const supabase = getSupabaseClient();
                const { data, error } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('session_id', sessionId)
                    .single();

                if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"

                if (data) {
                    if (data.prompt_history) setPromptHistory(data.prompt_history);
                    if (data.selected_snippets) setSelectedSnippets(data.selected_snippets);
                    if (data.negative_prompt) setNegativePrompt(data.negative_prompt);
                    if (data.aspect_ratios) setAspectRatios(data.aspect_ratios);
                }
            } catch (error) {
                console.error('Error loading settings from Supabase:', error);
            } finally {
                isInitialLoad.current = false;
            }
        };

        loadFromSupabase();
    }, [sessionId]);

    // Save to localStorage
    useEffect(() => { saveState('generator.prompt', prompt); }, [prompt]);
    useEffect(() => { saveState('generator.negativePrompt', negativePrompt); }, [negativePrompt]);
    useEffect(() => { saveState('generator.aspectRatios', aspectRatios); }, [aspectRatios]);
    useEffect(() => { saveState('generator.selectedSnippets', selectedSnippets); }, [selectedSnippets]);
    useEffect(() => { saveState('generator.promptHistory', promptHistory); }, [promptHistory]);

    // Sync to Supabase
    useEffect(() => {
        if (isInitialLoad.current) return;

        const syncToSupabase = async () => {
            try {
                const supabase = getSupabaseClient();
                const { error } = await supabase
                    .from('user_settings')
                    .upsert({
                        session_id: sessionId,
                        prompt_history: promptHistory,
                        selected_snippets: selectedSnippets,
                        negative_prompt: negativePrompt,
                        aspect_ratios: aspectRatios,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'session_id' });

                if (error) throw error;
            } catch (error) {
                console.error('Error syncing settings to Supabase:', error);
            }
        };

        const timeout = setTimeout(syncToSupabase, 1000); // Debounce sync
        return () => clearTimeout(timeout);
    }, [sessionId, promptHistory, selectedSnippets, negativePrompt, aspectRatios]);

    const toggleAspectRatio = useCallback((ratio: AspectRatio) => {
        setAspectRatios(prev => {
            const isSelected = prev.includes(ratio);
            if (isSelected) {
                return prev.length > 1 ? prev.filter(r => r !== ratio) : prev;
            } else {
                return [...prev, ratio];
            }
        });
    }, []);

    const toggleSnippet = useCallback((snippet: string) => {
        setSelectedSnippets(prev => 
            prev.includes(snippet) 
                ? prev.filter(s => s !== snippet) 
                : [...prev, snippet]
        );
    }, []);
    
    const toggleQuality = useCallback(() => {
        setIsHighQuality(prev => !prev);
    }, []);

    const addPromptToHistory = useCallback((newPrompt: string) => {
        setPromptHistory(prev => {
            const filtered = prev.filter(p => p.toLowerCase() !== newPrompt.toLowerCase());
            const updated = [newPrompt, ...filtered];
            return updated.slice(0, MAX_HISTORY);
        });
    }, []);

    return {
        prompt,
        setPrompt,
        negativePrompt,
        setNegativePrompt,
        aspectRatios,
        toggleAspectRatio,
        selectedSnippets,
        toggleSnippet,
        isHighQuality,
        setIsHighQuality: toggleQuality,
        promptHistory,
        addPromptToHistory
    };
};
