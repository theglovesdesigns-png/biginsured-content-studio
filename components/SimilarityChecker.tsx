
import React, { useEffect, useState } from 'react';
import { fetchPosts } from '../services/postService';
import { fetchGoogleSheetData } from '../services/googleSheetsService';
import { SUPABASE_CONFIG } from '../services/config';
import { calculateSimilarity } from '../services/intelligenceService';

const SHEET_ID = '116g8WqLHlWjjEXfavJVcUAzNvEKGCQ1-F38L8V76Ots';
const PIPELINE_SHEET = 'Future_Blog_Ideas_Copied';
const SCHEDULE_SHEET = 'Blog Schedule';

interface SimilarityResult {
    title: string;
    score: number;
}

const SimilarityChecker: React.FC = () => {
    const [syncState, setSyncState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [existingTitles, setExistingTitles] = useState<string[]>([]);
    const [proposedTitle, setProposedTitle] = useState('');
    const [results, setResults] = useState<SimilarityResult[]>([]);
    const [top10Average, setTop10Average] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [hasChecked, setHasChecked] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setSyncState('loading');
        if (existingTitles.length === 0) setIsLoading(true);
        setError(null);
        try {
            // 1. Fetch from Supabase
            const posts = await fetchPosts();
            const dbTitles = posts.flatMap(p => [p.title, (p as any).original_title])
                .map(t => (t || '').trim())
                .filter(Boolean);

            // 2. Fetch from Google Sheets
            let sheetTitles: string[] = [];
            try {
                const scheduleData = await fetchGoogleSheetData(SHEET_ID, SCHEDULE_SHEET);
                const pipelineData = await fetchGoogleSheetData(SHEET_ID, PIPELINE_SHEET);
                
                sheetTitles = [...scheduleData, ...pipelineData].map((row: any) => {
                    const keys = Object.keys(row);
                    const titleKey = keys.find(k => k.toLowerCase().trim() === 'title' || k.toLowerCase().trim() === 'idea') || 
                                     keys.find(k => k.toLowerCase().trim().includes('title') && !k.toLowerCase().trim().includes('meta')) || 
                                     keys[0];
                    return String(row[titleKey] || '').trim();
                }).filter(Boolean);
            } catch (err) {
                console.warn('Silent failure fetching sheet data for similarity:', err);
            }

            // Merge and deduplicate
            const allTitles = Array.from(new Set([...dbTitles, ...sheetTitles]));
            console.log(`Synced ${allTitles.length} unique titles (${dbTitles.length} from DB, ${sheetTitles.length} from Sheet)`);
            
            setExistingTitles(allTitles);
            setSyncState('success');
            setTimeout(() => setSyncState('idle'), 3000);
        } catch (err) {
            console.error('Similarity data fetch error:', err);
            setError('Failed to fetch existing blog titles.');
            setSyncState('error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCheck = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedProposed = proposedTitle.trim();
        if (!trimmedProposed) return;

        const similarityResults = existingTitles.map(title => {
            const score = Math.round(calculateSimilarity(trimmedProposed, title) * 100);
            return { title, score };
        })
        .filter(res => res.score > 0)
        .sort((a, b) => b.score - a.score);

        // Take only top 10
        const top10 = similarityResults.slice(0, 10);
        
        // Calculate average of top 10
        if (top10.length > 0) {
            const sum = top10.reduce((acc, res) => acc + res.score, 0);
            setTop10Average(Math.round(sum / top10.length));
        } else {
            setTop10Average(0);
        }

        setResults(top10);
        setHasChecked(true);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500 text-center p-8 font-bold uppercase tracking-widest">{error}</div>;
    }

    return (
        <div className="w-full max-w-4xl mx-auto p-4">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-8 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="w-2 h-8 bg-orange-600 rounded-full"></span>
                    Similarity Checker
                </div>
                <button 
                    onClick={loadData}
                    disabled={syncState === 'loading'}
                    className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 border rounded-xl transition-all flex items-center gap-2 ${
                        syncState === 'success' 
                        ? 'bg-green-600 border-green-600 text-white' 
                        : syncState === 'error'
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'border-orange-600/30 text-orange-600 hover:bg-orange-600 hover:text-white cursor-pointer'
                    }`}
                    title="Reload data from database and sheets"
                >
                    {syncState === 'loading' && (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    )}
                    {syncState === 'success' ? 'Synced!' : syncState === 'error' ? 'Error' : 'Sync DB'}
                </button>
            </h2>

            <div className="bg-gray-900/50 rounded-[2rem] p-8 border border-gray-800 shadow-2xl">
                <form onSubmit={handleCheck} className="flex flex-col gap-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 block">Proposed Blog Title</label>
                        <input 
                            type="text" 
                            value={proposedTitle}
                            onChange={(e) => setProposedTitle(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-5 text-lg outline-none focus:border-orange-500 text-white font-bold placeholder:text-gray-700" 
                            placeholder="e.g., 5 Tips for Home Insurance in Ohio..." 
                        />
                    </div>
                    <button 
                        type="submit"
                        className="w-full py-5 bg-orange-600 text-white font-black text-lg uppercase tracking-tighter rounded-2xl shadow-[0_10px_30px_rgba(234,88,12,0.3)] hover:-translate-y-1 transition-all active:scale-95"
                    >
                        Check Similarity
                    </button>
                </form>

                {hasChecked && (
                    <div className="mt-10 animate-fade-in">
                        <div className="mb-8 p-6 bg-slate-900 border-2 border-orange-600/30 rounded-3xl flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.3em] mb-2">Global Similarity (Top 10)</span>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-5xl font-black ${top10Average >= 40 ? 'text-red-500' : 'text-white'}`}>{top10Average}%</span>
                                <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Match</span>
                            </div>
                            <p className="mt-4 text-[10px] text-gray-500 font-medium max-w-xs leading-relaxed">
                                {top10Average >= 40 
                                    ? "Critical overlap detected within your top 10 closest matches. Consider diversifying keywords."
                                    : "Healthy diversity against your existing content library."}
                            </p>
                        </div>

                        {results.length === 0 ? (
                            <div className="bg-green-500/10 border border-green-500/30 p-6 rounded-2xl text-green-500 font-black text-center uppercase tracking-widest">
                                No similar titles found. You're good to go!
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Similarity Results</h3>
                                {results.map((res, idx) => (
                                    <div key={idx} className={`p-5 rounded-2xl border flex items-center justify-between ${res.score >= 40 ? 'bg-red-500/10 border-red-500/30' : 'bg-gray-950 border-gray-800'}`}>
                                        <span className="text-sm font-bold text-white leading-tight">{res.title}</span>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full text-white ${res.score >= 40 ? 'bg-red-600' : 'bg-gray-800'}`}>
                                                {res.score}% Match
                                            </span>
                                            {res.score >= 40 && (
                                                <span className="text-[8px] font-black text-red-500 uppercase tracking-widest animate-pulse">Warning</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SimilarityChecker;
