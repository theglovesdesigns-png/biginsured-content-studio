
import React, { useEffect, useState, useMemo } from 'react';
import { fetchPosts } from '../services/postService';
import { fetchPipelineItems } from '../services/pipelinePersistence';
import { fetchGoogleSheetData } from '../services/googleSheetsService';
import { analyzeBalance, CategoryGoal } from '../services/intelligenceService';
import { CheckCircle2, AlertCircle, ArrowRight, BarChart3, Target, LayoutDashboard } from 'lucide-react';
import { Post } from '../types';

const SHEET_ID = '116g8WqLHlWjjEXfavJVcUAzNvEKGCQ1-F38L8V76Ots';
const PIPELINE_SHEET = 'Future_Blog_Ideas_Copied';
const SCHEDULE_SHEET = 'Blog Schedule';

const CategoryBalance: React.FC = () => {
    const [syncState, setSyncState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [stats, setStats] = useState<CategoryGoal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    const loadData = async () => {
        setSyncState('loading');
        if (stats.length === 0) setIsLoading(true);
        setError(null);
        try {
            // 1. Fetch Published from Supabase
            const posts = await fetchPosts();
            
            // 2. Fetch Staged from Supabase Pipeline
            let supaPipeline: any[] = [];
            try {
                supaPipeline = await fetchPipelineItems();
            } catch (err) {
                console.warn('Supabase pipeline fetch failed:', err);
            }
            
            // 3. Fetch Scheduled from "Blog Schedule" (Google Sheet)
            // 4. Fetch Staged from "Future_Blog_Ideas_Copied" (Pipeline Sheet)
            let externalRows: any[] = [];
            try {
                const scheduleData = await fetchGoogleSheetData(SHEET_ID, SCHEDULE_SHEET);
                const pipelineData = await fetchGoogleSheetData(SHEET_ID, PIPELINE_SHEET);
                externalRows = [...scheduleData, ...pipelineData];
            } catch (err) {
                console.warn('Silent failure fetching sheet data for balance:', err);
                // We don't throw hero because some or all might be empty
            }

            // Combine all titles for count
            const uniqueTitles = new Set<string>();
            const allItems: { title: string, category: string }[] = [];
            
            const addUniqueItem = (title: string, category: string) => {
                if (!title || !category) return;
                const cleanTitle = title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                if (!cleanTitle || cleanTitle === 'title' || cleanTitle === 'untitledpost' || cleanTitle === 'untitledidea') return;
                if (!uniqueTitles.has(cleanTitle)) {
                    uniqueTitles.add(cleanTitle);
                    allItems.push({ title: title.trim(), category: category.trim() });
                }
            };

            posts.forEach((p: Post) => {
                if (p.title && p.category) {
                    addUniqueItem(p.title, p.category);
                }
            });

            supaPipeline.forEach((p: any) => {
                if (p.title && p.category) {
                    addUniqueItem(p.title, p.category);
                }
            });

            externalRows.forEach((row: any) => {
                const keys = Object.keys(row);
                const findVal = (names: string[]) => {
                    const key = keys.find(k => names.some(n => k.toLowerCase().trim() === n.toLowerCase().trim()));
                    return key ? row[key] : null;
                };
                
                const title = findVal(['Title', 'title', 'blog_title']);
                const category = findVal(['Category', 'category']);
                
                if (title && category) {
                    addUniqueItem(String(title), String(category));
                }
            });

            // Use our new Intelligence Service to calculate everything
            const calculatedStats = analyzeBalance(allItems);
            setStats(calculatedStats);
            
            setSyncState('success');
            setTimeout(() => setSyncState('idle'), 3000);
        } catch (err) {
            console.error('Category balance data fetch error:', err);
            setError(`Failed to load category balance data.`);
            setSyncState('error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const totalCurrent = useMemo(() => stats.reduce((acc, s) => acc + s.current, 0), [stats]);
    const totalGoal = useMemo(() => stats.reduce((acc, s) => acc + s.goal, 0), [stats]);
    const overallProgress = Math.round((totalCurrent / (totalGoal || 1)) * 100);

    if (isLoading && stats.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto p-4 animate-fade-in">
            {/* Header Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                <div className="md:col-span-2 bg-gray-900 border border-gray-800 p-8 rounded-[2rem] shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-orange-600/20 transition-all duration-500"></div>
                    <div className="relative z-10">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block">Total Portfolio Strength</span>
                        <div className="flex items-baseline gap-3 mb-6">
                            <h2 className="text-6xl font-black text-white tracking-tighter tabular-nums">{totalCurrent}</h2>
                            <span className="text-xl font-bold text-slate-600">/ {totalGoal} Blogs</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                <span className="text-orange-500">{overallProgress}% Coverage</span>
                                <span className="text-slate-500">{totalGoal - totalCurrent} needed</span>
                            </div>
                            <div className="h-3 w-full bg-gray-950 rounded-full border border-gray-800 p-0.5">
                                <div 
                                    className="h-full bg-orange-600 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(234,88,12,0.4)]"
                                    style={{ width: `${overallProgress}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 p-8 rounded-[2rem] shadow-xl flex flex-col justify-center">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Critical Gaps</span>
                            <span className="text-2xl font-black text-white">{stats.filter(s => s.priority === '🔴 HIGH').length}</span>
                        </div>
                    </div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed">Categories needing immediate priority attention.</p>
                </div>

                <div className="bg-gray-900 border border-gray-800 p-8 rounded-[2rem] shadow-xl flex flex-col justify-center">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Goals Met</span>
                            <span className="text-2xl font-black text-white">{stats.filter(s => s.priority === '✅ GOAL MET').length}</span>
                        </div>
                    </div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed">Optimized categories with full authority status.</p>
                </div>
            </div>

            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <span className="w-2 h-8 bg-orange-600 rounded-full"></span>
                    Category Intelligence
                </h2>
                <div className="flex items-center gap-4">
                    <div className="flex bg-gray-900 p-1 rounded-xl border border-gray-800">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'grid' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            Grid
                        </button>
                        <button 
                            onClick={() => setViewMode('table')}
                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'table' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            Table
                        </button>
                    </div>
                    <button 
                        onClick={loadData}
                        disabled={syncState === 'loading'}
                        className={`text-[10px] font-black uppercase tracking-[0.2em] px-6 py-2.5 rounded-xl border transition-all flex items-center gap-2 ${
                            syncState === 'success' 
                            ? 'bg-green-600 border-green-600 text-white' 
                            : 'bg-orange-600 border-orange-600 text-white hover:brightness-110 active:scale-95'
                        }`}
                    >
                        {syncState === 'loading' ? 'Syncing...' : syncState === 'success' ? 'Intellgience Synced' : 'Refresh Data'}
                    </button>
                </div>
            </div>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stats.map(stat => (
                        <div key={stat.category} className="bg-gray-900 border border-gray-800 p-8 rounded-[2rem] hover:border-orange-500/30 transition-all group">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1">{stat.category}</h3>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                        stat.priority.includes('RED') || stat.priority.includes('🔴') ? 'bg-red-500 text-white' :
                                        stat.priority.includes('YELLOW') || stat.priority.includes('🟡') ? 'bg-orange-500 text-white' :
                                        stat.priority.includes('GREEN') || stat.priority.includes('🟢') ? 'bg-green-500 text-white' :
                                        'bg-blue-600 text-white'
                                    }`}>
                                        {stat.priority}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-white tabular-nums">{stat.current}</span>
                                    <span className="text-xs font-bold text-slate-600 block">/ {stat.goal} Target</span>
                                </div>
                            </div>

                            <div className="space-y-3 mb-8">
                                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <span>Progress</span>
                                    <span>{stat.progress}%</span>
                                </div>
                                <div className="h-2 w-full bg-gray-950 rounded-full overflow-hidden border border-gray-800">
                                    <div 
                                        className="h-full bg-orange-600 rounded-full transition-all duration-1000"
                                        style={{ width: `${stat.progress}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-gray-800 flex justify-between items-center">
                                <div className="text-[10px] font-black uppercase text-slate-500">
                                    Gap: <span className="text-white">{stat.difference > 0 ? stat.difference : 0} Blogs</span>
                                </div>
                                <button className="text-[9px] font-black uppercase text-orange-600 tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 flex items-center gap-1">
                                    Fill Gap <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-[2rem] overflow-hidden shadow-2xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-950/50 border-b border-gray-800">
                                <th className="p-6 text-[10px] font-black uppercase text-slate-500 tracking-widest">Category</th>
                                <th className="p-6 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Count</th>
                                <th className="p-6 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Goal</th>
                                <th className="p-6 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Difference</th>
                                <th className="p-6 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Priority</th>
                                <th className="p-6 text-[10px] font-black uppercase text-slate-500 tracking-widest">Progress</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.map((stat, idx) => (
                                <tr key={stat.category} className={`border-b border-gray-800 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/2'}`}>
                                    <td className="p-6 font-black text-white text-sm uppercase tracking-tight">{stat.category}</td>
                                    <td className="p-6 text-center font-bold text-white tabular-nums">{stat.current}</td>
                                    <td className="p-6 text-center font-medium text-slate-400 tabular-nums">{stat.goal}</td>
                                    <td className="p-6 text-center font-bold text-orange-500 tabular-nums">{stat.difference > 0 ? stat.difference : 0}</td>
                                    <td className="p-6 text-center">
                                        <span className={`text-[9px] font-black px-3 py-1 rounded-lg ${
                                            stat.priority.includes('🔴') ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                            stat.priority.includes('🟡') ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' :
                                            'bg-green-500/10 text-green-500 border border-green-500/20'
                                        }`}>
                                            {stat.priority}
                                        </span>
                                    </td>
                                    <td className="p-6 min-w-[200px]">
                                        <div className="flex items-center gap-4">
                                            <div className="flex-grow h-1.5 bg-gray-950 rounded-full overflow-hidden border border-gray-800">
                                                <div 
                                                    className="h-full bg-orange-600 rounded-full"
                                                    style={{ width: `${stat.progress}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 tabular-nums">{stat.progress}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-orange-600/5">
                                <td className="p-6 font-black text-orange-500 text-sm uppercase tracking-widest">Total Portfolio</td>
                                <td className="p-6 text-center font-black text-white tabular-nums text-lg">{totalCurrent}</td>
                                <td className="p-6 text-center font-bold text-slate-500 tabular-nums">{totalGoal}</td>
                                <td className="p-6 text-center font-black text-orange-500 tabular-nums">{totalGoal - totalCurrent}</td>
                                <td className="p-6"></td>
                                <td className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="flex-grow h-3 bg-gray-950 rounded-full overflow-hidden border border-gray-800 p-0.5">
                                            <div 
                                                className="h-full bg-orange-600 rounded-full shadow-[0_0_10px_rgba(234,88,12,0.3)]"
                                                style={{ width: `${overallProgress}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs font-black text-white tabular-nums">{overallProgress}%</span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            <div className="mt-12 p-8 bg-gray-900/30 border border-gray-800 rounded-[2rem]">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-orange-500" /> Content Roadmap Logic
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <div className="space-y-2">
                        <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter">🔴 High Priority</span>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Missing 10+ blogs. These categories are under-indexed and need immediate focus to build SEO authority.</p>
                    </div>
                    <div className="space-y-2">
                        <span className="text-[9px] font-black text-orange-400 uppercase tracking-tighter">🟡 Medium Priority</span>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Missing 5-10 blogs. Consistent publishing here will stabilize your topical relevance.</p>
                    </div>
                    <div className="space-y-2">
                        <span className="text-[9px] font-black text-green-500 uppercase tracking-tighter">🟢 Low Priority</span>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Almost at goal. Maintenance mode. Sprinkle in seasonal updates to stay fresh.</p>
                    </div>
                    <div className="space-y-2">
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">✅ Goal Met</span>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Full coverage achieved. You've reached the target depth for these insurance topics.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoryBalance;
