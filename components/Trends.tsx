
import React, { useEffect, useState, useMemo } from 'react';
import { fetchIntelligentTrends, TrendTopic } from '../services/trendService';
import { calculateSimilarity } from '../services/intelligenceService';
import { RefreshCcw, TrendingUp, CheckCircle2, AlertCircle, ArrowUpRight, CloudLightning, ShieldCheck, Zap, Clock } from 'lucide-react';
import { fetchPosts } from '../services/postService';
import { fetchPipelineItems, savePipelineItem } from '../services/pipelinePersistence';

interface TrendsProps {
    onBlogThis: (data: { title: string, category: string, prompt?: string }) => void;
}

const Trends: React.FC<TrendsProps> = ({ onBlogThis }) => {
    const [existingTitles, setExistingTitles] = useState<string[]>([]);
    const [trends, setTrends] = useState<TrendTopic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [syncState, setSyncState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [activeFilter, setActiveFilter] = useState<'All' | 'Weather' | 'Insurance' | 'Strategy'>('All');
    const [addingId, setAddingId] = useState<string | null>(null);
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

    const loadData = async () => {
        setSyncState('loading');
        if (trends.length === 0) setIsLoading(true);
        try {
            // 1. Fetch existing for similarity check
            const [posts, supaPipeline] = await Promise.all([
                fetchPosts(),
                fetchPipelineItems()
            ]);
            
            const titles = [
                ...posts.map(p => p.title),
                ...supaPipeline.map(p => p.title)
            ].filter(Boolean);
            
            setExistingTitles(titles);

            // 2. Fetch intelligent trends via Gemini + Search Grounding
            const discoveryData = await fetchIntelligentTrends();
            
            // 3. Filter trends by similarity immediately
            const uniqueTrends = discoveryData.filter(t => {
                const maxSim = Math.max(...titles.map(et => calculateSimilarity(t.title, et)));
                return maxSim < 0.6; // Only keep truly unique ones
            });

            setTrends(uniqueTrends);
            setSyncState('success');
            setTimeout(() => setSyncState('idle'), 3000);
        } catch (err) {
            console.error('Trends discovery error:', err);
            setSyncState('error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAddToPipeline = async (trend: TrendTopic) => {
        setAddingId(trend.title);
        try {
            await savePipelineItem({
                title: trend.title,
                category: trend.category,
                prompt: trend.description,
                status: 'NOT STARTED',
                best_posting_time: 'Anytime',
                timestamp: new Date().toLocaleString()
            });
            setAddedIds(prev => new Set(prev).add(trend.title));
            // Automatically refresh titles to update similarity if needed, though here we just want the checkbox
        } catch (err) {
            console.error("Failed to add trend to pipeline:", err);
            alert("Failed to add to pipeline. Check connection.");
        } finally {
            setAddingId(null);
        }
    };

    const filteredTrends = useMemo(() => {
        if (activeFilter === 'All') return trends;
        return trends.filter(t => t.source === activeFilter);
    }, [trends, activeFilter]);

    if (isLoading && trends.length === 0) {
        return (
            <div className="flex flex-col justify-center items-center h-64 gap-4">
                <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">AI Strategic Scouting in Progress...</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto p-4 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
                <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3 mb-2">
                        <span className="w-2 h-10 bg-orange-600 rounded-full shadow-[0_0_15px_rgba(234,88,12,0.4)]"></span>
                        Trend Monitor
                    </h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Real-time Market & Weather Intelligence</p>
                </div>
                
                <div className="flex items-center gap-4">
                    {syncState === 'success' && (
                        <span className="text-green-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 animate-pulse">
                            <CheckCircle2 className="w-3 h-3" /> Scouts Returned
                        </span>
                    )}
                    <button 
                        onClick={loadData}
                        disabled={syncState === 'loading'}
                        className="group flex items-center gap-3 bg-gray-900 border border-gray-800 hover:border-orange-500 px-6 py-3 rounded-2xl transition-all shadow-xl active:scale-95"
                    >
                        <RefreshCcw className={`w-4 h-4 text-orange-500 ${syncState === 'loading' ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Scout New Trends</span>
                    </button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-10 overflow-x-auto pb-2 scrollbar-none">
                {(['All', 'Insurance', 'Weather', 'Strategy'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setActiveFilter(f)}
                        className={`px-6 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 ${
                            activeFilter === f 
                            ? 'bg-orange-600 border-orange-600 text-white shadow-lg' 
                            : 'bg-gray-900 border-gray-800 text-slate-500 hover:border-slate-700 hover:text-white'
                        }`}
                    >
                        {f === 'Weather' && <CloudLightning className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />}
                        {f === 'Insurance' && <ShieldCheck className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />}
                        {f === 'Strategy' && <Zap className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />}
                        {f} Trends
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredTrends.length === 0 ? (
                    <div className="col-span-full text-center p-32 bg-gray-900/20 rounded-[4rem] border-2 border-gray-800 border-dashed">
                        <TrendingUp className="w-12 h-12 text-gray-800 mx-auto mb-6" />
                        <p className="text-slate-500 font-black uppercase tracking-[0.4em] text-[10px]">No unique {activeFilter.toLowerCase()} trends discovered. Try scouting again.</p>
                    </div>
                ) : (
                    filteredTrends.map((trend, idx) => (
                        <div key={idx} className="bg-gray-900/40 rounded-[2.5rem] p-8 border border-gray-800 flex flex-col justify-between hover:border-orange-500/50 hover:bg-gray-900/60 transition-all group relative overflow-hidden backdrop-blur-sm">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                {trend.source === 'Weather' && <CloudLightning className="w-12 h-12 text-blue-400" />}
                                {trend.source === 'Insurance' && <ShieldCheck className="w-12 h-12 text-green-400" />}
                                {trend.source === 'Strategy' && <Zap className="w-12 h-12 text-orange-400" />}
                            </div>
                            
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border ${
                                        trend.source === 'Weather' ? 'text-blue-400 border-blue-400/20 bg-blue-400/5' :
                                        trend.source === 'Insurance' ? 'text-green-400 border-green-400/20 bg-green-400/5' :
                                        'text-orange-400 border-orange-400/20 bg-orange-400/5'
                                    }`}>
                                        {trend.category}
                                    </span>
                                    <span className="text-[10px] font-black text-white bg-white/5 w-6 h-6 rounded flex items-center justify-center">
                                        {trend.priority}
                                    </span>
                                </div>
                                <h3 className="text-xl font-black text-white tracking-tighter leading-[1.2] group-hover:text-orange-500 transition-colors mb-4 pr-12">
                                    {trend.title}
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold leading-relaxed line-clamp-3 mb-6 uppercase tracking-tighter decoration-orange-500/30 underline-offset-4">
                                    {trend.description}
                                </p>
                            </div>
                            
                                <button 
                                    disabled={addingId === trend.title || addedIds.has(trend.title)}
                                    onClick={() => handleAddToPipeline(trend)}
                                    className={`mt-4 group/btn relative flex items-center justify-center gap-3 py-4 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl active:scale-95 overflow-hidden w-full ${
                                        addedIds.has(trend.title)
                                        ? 'bg-green-600 text-white'
                                        : 'bg-orange-600 text-white hover:bg-orange-500'
                                    }`}
                                >
                                    <span className="relative z-10">
                                        {addingId === trend.title ? 'Syncing...' : addedIds.has(trend.title) ? 'Added to Pipeline' : 'Add to Pipeline'}
                                    </span>
                                    {addingId === trend.title ? (
                                        <Clock className="w-4 h-4 animate-spin relative z-10" />
                                    ) : addedIds.has(trend.title) ? (
                                        <CheckCircle2 className="w-4 h-4 relative z-10" />
                                    ) : (
                                        <ArrowUpRight className="w-4 h-4 relative z-10 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                                    )}
                                </button>
                        </div>
                    ))
                )}
            </div>
            
            <div className="mt-16 p-8 bg-gray-900 border border-gray-800 rounded-[2rem] flex flex-col md:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/5 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                <div className="bg-orange-600/10 p-5 rounded-[1.5rem]">
                    <Zap className="w-8 h-8 text-orange-500" />
                </div>
                <div className="flex-grow">
                    <h4 className="text-lg font-black text-white uppercase tracking-tighter mb-1">Intelligent Advisor</h4>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-relaxed">
                        Trends are currently generated using <span className="text-orange-500 italic">Gemini 3 Flash</span> with Google Search grounding. 
                        Scouts scan for Ohio-specific insurance needs, seasonality, and upcoming weather threats.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Trends;
