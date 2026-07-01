import React, { useState, useEffect } from 'react';
import { fetchPosts } from '../services/postService';
import { fetchGoogleSheetData, deleteIdeaRow } from '../services/googleSheetsService';
import {
    findDuplicates,
    logAuditRun,
    getLatestAuditRun,
    getAuditHistory,
    AuditItem,
    DuplicatePair,
    AuditLogEntry,
} from '../services/auditService';
import {
    FileSpreadsheet,
    Sparkles,
    AlertTriangle,
    CheckCircle2,
    ExternalLink,
    RefreshCw,
    Search,
    Clock,
    Layers,
    ListFilter,
    Trash2,
} from 'lucide-react';

const SHEET_ID = '116g8WqLHlWjjEXfavJVcUAzNvEKGCQ1-F38L8V76Ots';
const PIPELINE_SHEET = 'Future_Blog_Ideas_Copied';
const SCHEDULE_SHEET = 'Blog Schedule';

const SheetAuditor: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [syncState, setSyncState] = useState<'idle' | 'loading' | 'success' | 'err'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [currentStatusMsg, setCurrentStatusMsg] = useState('');

    const [ideasCount, setIdeasCount] = useState(0);
    const [scheduleCount, setScheduleCount] = useState(0);
    const [websiteCount, setWebsiteCount] = useState(0);
    const [allItems, setAllItems] = useState<AuditItem[]>([]);
    const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [sourceFilter, setSourceFilter] = useState<'all' | 'ideas' | 'schedule' | 'website'>('all');

    const [lastRun, setLastRun] = useState<AuditLogEntry | null>(null);
    const [history, setHistory] = useState<AuditLogEntry[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
    const [removeError, setRemoveError] = useState<string | null>(null);

    const findColumnValue = (row: any, possibleNames: string[], partialMatchKeyword?: string, excludeKeyword?: string): string | null => {
        const keys = Object.keys(row);
        const exactKey = keys.find(k => {
            const cleanKey = k.trim().toLowerCase();
            return possibleNames.some(name => cleanKey === name.trim().toLowerCase());
        });
        if (exactKey !== undefined && row[exactKey] !== undefined && row[exactKey] !== null) {
            return String(row[exactKey]).trim();
        }
        if (partialMatchKeyword) {
            const partialKey = keys.find(k => {
                const cleanKey = k.trim().toLowerCase();
                const containsKeyword = cleanKey.includes(partialMatchKeyword.trim().toLowerCase());
                const hasExclude = excludeKeyword ? cleanKey.includes(excludeKeyword.trim().toLowerCase()) : false;
                return containsKeyword && !hasExclude;
            });
            if (partialKey !== undefined && row[partialKey] !== undefined && row[partialKey] !== null) {
                return String(row[partialKey]).trim();
            }
        }
        return null;
    };

    const loadRawData = async (autoRunAudit = true) => {
        setSyncState('loading');
        setIsLoading(true);
        setError(null);
        setCurrentStatusMsg('Connecting to Google Sheets and Supabase...');

        try {
            setCurrentStatusMsg('Fetching live articles from biginsured.com...');
            const dbPosts = await fetchPosts();
            const formattedDbPosts: AuditItem[] = dbPosts.map(p => ({
                id: `db-${p.id}`,
                title: p.title || p.slug || 'Untitled Post',
                category: p.category || 'General',
                source: 'Live Website',
                status: p.status || 'Published',
            }));
            setWebsiteCount(dbPosts.length);

            setCurrentStatusMsg('Reading "Future_Blog_Ideas_Copied" tab...');
            let rawIdeas: any[] = [];
            try {
                rawIdeas = await fetchGoogleSheetData(SHEET_ID, PIPELINE_SHEET);
            } catch (err) {
                console.warn('Failed reading ideas tab:', err);
            }

            const formattedIdeas: AuditItem[] = rawIdeas.map((row, idx) => {
                const keys = Object.keys(row);
                const titleVal = findColumnValue(row, ['title', 'idea', 'topic', 'heading', 'blog title'], 'title', 'meta') ||
                    (keys.length > 0 && row[keys[0]] ? String(row[keys[0]]).trim() : '');
                const categoryVal = findColumnValue(row, ['category', 'type', 'genre'], 'category') ||
                    (keys.length > 1 && row[keys[1]] && keys[1].toLowerCase() !== 'title' ? String(row[keys[1]]).trim() : 'General Insurance');
                const statusVal = findColumnValue(row, ['status', 'state', 'stage'], 'status') || '';

                return {
                    id: `idea-${idx}`,
                    title: titleVal,
                    category: categoryVal,
                    source: 'Ideas Tab' as const,
                    status: statusVal,
                    rowRef: `Row #${idx + 2}`,
                    rowNumber: idx + 2, // actual spreadsheet row (header is row 1)
                };
            }).filter(item => item.title && item.title.toLowerCase() !== 'title' && item.title !== 'Untitled Idea');
            setIdeasCount(formattedIdeas.length);

            setCurrentStatusMsg('Reading "Blog Schedule" tab...');
            let rawSchedule: any[] = [];
            try {
                rawSchedule = await fetchGoogleSheetData(SHEET_ID, SCHEDULE_SHEET);
            } catch (err) {
                console.warn('Failed reading schedule tab:', err);
            }

            const formattedSchedule: AuditItem[] = rawSchedule.map((row, idx) => {
                const keys = Object.keys(row);
                const titleVal = findColumnValue(row, ['title', 'post', 'heading', 'blog title'], 'title', 'meta') ||
                    (keys.length > 1 && keys[1].toLowerCase().includes('title') ? String(row[keys[1]]).trim() :
                        (keys.length > 0 ? String(row[keys[0]]).trim() : ''));
                const categoryVal = findColumnValue(row, ['category', 'type', 'genre'], 'category') ||
                    (keys.length > 4 && row[keys[4]] ? String(row[keys[4]]).trim() : 'General Insurance');
                const dateStr = findColumnValue(row, ['publish time', 'publish_at_time', 'scheduled date', 'publish date', 'date'], 'publish') ||
                    findColumnValue(row, ['time', 'scheduled'], 'time') ||
                    (keys.length > 11 && row[keys[11]] ? String(row[keys[11]]).trim() : '');
                const statusVal = findColumnValue(row, ['status', 'state', 'stage'], 'status') || '';

                return {
                    id: `sched-${idx}`,
                    title: titleVal,
                    category: categoryVal,
                    source: 'Blog Schedule' as const,
                    status: statusVal,
                    rowRef: dateStr ? `Scheduled: ${dateStr}` : `Row #${idx + 2}`,
                };
            }).filter(item => item.title && item.title.toLowerCase() !== 'title' && item.title !== 'Untitled Post');
            setScheduleCount(formattedSchedule.length);

            const merged = [...formattedIdeas, ...formattedSchedule, ...formattedDbPosts];
            setAllItems(merged);

            // Run the instant, free, client-side duplicate detector automatically.
            // No AI tokens needed for this — pure title comparison.
            if (autoRunAudit) {
                setCurrentStatusMsg('Scanning for duplicate and near-duplicate titles...');
                const dupes = findDuplicates(merged, 85);
                setDuplicates(dupes);

                // Log this run permanently so "when was this last checked" is never lost
                await logAuditRun({
                    ideas_count: formattedIdeas.length,
                    schedule_count: formattedSchedule.length,
                    website_count: dbPosts.length,
                    duplicates_found: dupes.length,
                });
                const latest = await getLatestAuditRun();
                setLastRun(latest);
            }

            setSyncState('success');
            setCurrentStatusMsg('');
            setTimeout(() => setSyncState('idle'), 3000);
        } catch (err) {
            console.error('Audit load error:', err);
            setError('Failed to fetch and process spreadsheet data.');
            setSyncState('err');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadRawData();
        getLatestAuditRun().then(setLastRun);
        getAuditHistory().then(setHistory);
    }, []);

    const filteredItems = allItems.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSource =
            sourceFilter === 'all' ||
            (sourceFilter === 'ideas' && item.source === 'Ideas Tab') ||
            (sourceFilter === 'schedule' && item.source === 'Blog Schedule') ||
            (sourceFilter === 'website' && item.source === 'Live Website');
        return matchesSearch && matchesSource;
    });

    /**
     * Removes an Ideas-tab duplicate row. By design this can ONLY ever
     * target items where source === 'Ideas Tab' — Blog Schedule and Live
     * Website items are never removable from this UI, since those represent
     * content that's already scheduled or published and must stay intact.
     */
    const handleRemove = async (item: AuditItem) => {
        if (item.source !== 'Ideas Tab' || !item.rowNumber) return;
        setRemoveError(null);
        setRemovingId(item.id);
        try {
            await deleteIdeaRow(item.title, item.rowNumber);
            setRemovedIds(prev => new Set(prev).add(item.id));
            setAllItems(prev => prev.filter(i => i.id !== item.id));
        } catch (err) {
            console.error('Failed to remove row:', err);
            setRemoveError(err instanceof Error ? err.message : 'Failed to remove this item. Try refreshing and again.');
        } finally {
            setRemovingId(null);
        }
    };

    /**
     * "Remove All Resolved Ideas" — finds every duplicate pair where one
     * side is an Ideas-tab item and the other side is already Protected
     * (Blog Schedule or Live Website). These are topics that already got
     * written and published; the idea row is just stale leftover. Only the
     * Ideas-tab side is ever touched — the protected side is never an option.
     */
    const resolvedIdeaDuplicates = duplicates.filter(pair => {
        const ideasItem = pair.itemA.source === 'Ideas Tab' ? pair.itemA : (pair.itemB.source === 'Ideas Tab' ? pair.itemB : null);
        const protectedItem = pair.itemA.source !== 'Ideas Tab' ? pair.itemA : pair.itemB;
        return ideasItem && protectedItem && protectedItem.source !== 'Ideas Tab' && !removedIds.has(ideasItem.id);
    });

    // De-dupe in case the same Ideas row matches multiple protected entries
    const uniqueResolvedIdeaItems: AuditItem[] = Array.from(
        new Map<string, AuditItem>(
            resolvedIdeaDuplicates.map(pair => {
                const ideasItem = (pair.itemA.source === 'Ideas Tab' ? pair.itemA : pair.itemB) as AuditItem;
                return [ideasItem.id, ideasItem] as [string, AuditItem];
            })
        ).values()
    );

    const [showBulkConfirm, setShowBulkConfirm] = useState(false);
    const [bulkRemoving, setBulkRemoving] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

    const handleBulkRemove = async () => {
        setBulkRemoving(true);
        setRemoveError(null);
        setBulkProgress({ done: 0, total: uniqueResolvedIdeaItems.length });

        for (const item of uniqueResolvedIdeaItems) {
            if (!item.rowNumber) continue;
            try {
                await deleteIdeaRow(item.title, item.rowNumber);
                setRemovedIds(prev => new Set(prev).add(item.id));
                setAllItems(prev => prev.filter(i => i.id !== item.id));
            } catch (err) {
                console.error(`Failed to remove "${item.title}":`, err);
                // Continue the batch even if one row fails — report at the end
            }
            setBulkProgress(prev => ({ ...prev, done: prev.done + 1 }));
        }

        setBulkRemoving(false);
        setShowBulkConfirm(false);
    };

    const formatTimeAgo = (isoString: string): string => {
        const diffMs = Date.now() - new Date(isoString).getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins} min ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} hr ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days === 1 ? '' : 's'} ago`;
    };

    const sourceColor = (source: string) => {
        if (source === 'Ideas Tab') return 'emerald';
        if (source === 'Blog Schedule') return 'purple';
        return 'cyan';
    };

    return (
        <div className="max-w-7xl mx-auto px-4 pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                        <FileSpreadsheet className="w-7 h-7 text-orange-600" />
                        Content Audit
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-semibold text-xs mt-1">
                        Cross-checks Ideas, Schedule, and Live Website for duplicates — runs automatically, every time.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => loadRawData(true)}
                        disabled={isLoading}
                        className="p-2.5 rounded-xl bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-gray-700 transition-all"
                        title="Re-run audit now"
                    >
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${SHEET_ID}`, '_blank')}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-md"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Open Sheet
                    </button>
                </div>
            </div>

            {/* Last run banner — always visible, this is the "note of when this was done" */}
            <div className="bg-slate-50 dark:bg-gray-900/40 border border-slate-200 dark:border-gray-800 rounded-2xl px-5 py-3.5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <Clock className="w-4 h-4 text-orange-600 shrink-0" />
                    {lastRun ? (
                        <span>
                            Last audited <span className="text-slate-900 dark:text-white">{formatTimeAgo(lastRun.run_at)}</span>
                            {' '}({new Date(lastRun.run_at).toLocaleString()}) ·{' '}
                            <span className={lastRun.duplicates_found > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                {lastRun.duplicates_found} potential duplicate{lastRun.duplicates_found === 1 ? '' : 's'} found
                            </span>
                        </span>
                    ) : (
                        <span>No audit history yet — runs automatically every time you open this page.</span>
                    )}
                </div>
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 hover:underline self-start sm:self-auto"
                >
                    {showHistory ? 'Hide' : 'View'} History
                </button>
            </div>

            {showHistory && (
                <div className="bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-2xl p-4 mb-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Recent Audit Runs</h4>
                    <div className="space-y-1.5">
                        {history.map((h, i) => (
                            <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-gray-900 last:border-0">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{new Date(h.run_at).toLocaleString()}</span>
                                <span className="text-slate-400">{h.ideas_count} ideas · {h.schedule_count} scheduled · {h.website_count} live</span>
                                <span className={h.duplicates_found > 0 ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold'}>
                                    {h.duplicates_found} dupes
                                </span>
                            </div>
                        ))}
                        {history.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No history yet.</p>}
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-900/50 p-5 rounded-2xl mb-6 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <p className="text-red-700 dark:text-red-300 text-sm font-bold">{error}</p>
                </div>
            )}

            {/* Resource counts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" /> Ideas Backlog
                    </span>
                    <span className="text-lg font-mono font-black text-slate-800 dark:text-white">{ideasCount}</span>
                </div>
                <div className="bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500" /> Scheduled
                    </span>
                    <span className="text-lg font-mono font-black text-slate-800 dark:text-white">{scheduleCount}</span>
                </div>
                <div className="bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-500" /> Live Website
                    </span>
                    <span className="text-lg font-mono font-black text-slate-800 dark:text-white">{websiteCount}</span>
                </div>
            </div>

            {isLoading && (
                <div className="bg-slate-50/50 dark:bg-gray-950/20 border-2 border-dashed border-orange-500/30 p-10 rounded-2xl mb-6 text-center">
                    <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-orange-600 dark:text-orange-400 font-black text-xs uppercase tracking-widest">{currentStatusMsg || 'Working...'}</p>
                </div>
            )}

            {/* Duplicate results — the real, actionable output */}
            {!isLoading && (
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-orange-600" />
                            Duplicate &amp; Overlap Findings
                        </h3>
                        {uniqueResolvedIdeaItems.length > 0 && (
                            <button
                                onClick={() => setShowBulkConfirm(true)}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-md self-start sm:self-auto"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove All Resolved Ideas ({uniqueResolvedIdeaItems.length})
                            </button>
                        )}
                    </div>

                    {/* Bulk removal confirmation modal */}
                    {showBulkConfirm && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !bulkRemoving && setShowBulkConfirm(false)}>
                            <div className="bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                                {!bulkRemoving ? (
                                    <>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                                                <Trash2 className="w-5 h-5 text-red-600" />
                                            </div>
                                            <h3 className="text-base font-black text-slate-900 dark:text-white">Remove Resolved Ideas?</h3>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                            This will delete <span className="font-black text-slate-900 dark:text-white">{uniqueResolvedIdeaItems.length}</span> row{uniqueResolvedIdeaItems.length === 1 ? '' : 's'} from the Ideas tab — topics that are already scheduled or published, where the idea entry is just leftover.
                                        </p>
                                        <p className="text-xs text-slate-400 mb-4">
                                            Nothing in Blog Schedule or Live Website is ever touched. This only removes Ideas-tab rows.
                                        </p>
                                        <div className="max-h-40 overflow-y-auto bg-slate-50 dark:bg-gray-900 rounded-xl p-3 mb-4 space-y-1">
                                            {uniqueResolvedIdeaItems.slice(0, 8).map(item => (
                                                <p key={item.id} className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 truncate">{item.title}</p>
                                            ))}
                                            {uniqueResolvedIdeaItems.length > 8 && (
                                                <p className="text-[11px] font-bold text-slate-400">+ {uniqueResolvedIdeaItems.length - 8} more...</p>
                                            )}
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setShowBulkConfirm(false)}
                                                className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleBulkRemove}
                                                className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 transition-all"
                                            >
                                                Yes, Delete {uniqueResolvedIdeaItems.length}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-4">
                                        <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                        <p className="text-sm font-black text-slate-900 dark:text-white">
                                            Removing {bulkProgress.done} of {bulkProgress.total}...
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">Please don't close this tab.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {removeError && (
                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl p-3 mb-3 text-xs font-bold text-red-700 dark:text-red-300">
                            {removeError}
                        </div>
                    )}

                    {duplicates.length === 0 ? (
                        <div className="text-center bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-10 rounded-2xl">
                            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
                            <p className="text-slate-900 dark:text-white font-black text-sm">No duplicates detected</p>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Ideas, Schedule, and Live Website are all clean against each other.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {duplicates
                                .filter(pair => !removedIds.has(pair.itemA.id) && !removedIds.has(pair.itemB.id))
                                .map((pair, idx) => (
                                <div key={idx} className="bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4">
                                    <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest
                                        ${pair.matchType === 'Exact' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                                          : pair.matchType === 'Near-Exact' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                        {pair.matchType} · {pair.similarity}%
                                    </span>
                                    <div className="flex-1 grid sm:grid-cols-2 gap-3">
                                        {[pair.itemA, pair.itemB].map((item, i) => {
                                            const canRemove = item.source === 'Ideas Tab';
                                            const isRemoving = removingId === item.id;
                                            return (
                                                <div key={i} className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <span className={`text-[9px] font-black uppercase text-${sourceColor(item.source)}-600`}>{item.source}</span>
                                                        <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug">{item.title}</p>
                                                        {item.rowRef && <span className="text-[10px] text-slate-400 font-mono">{item.rowRef}</span>}
                                                    </div>
                                                    {canRemove ? (
                                                        <button
                                                            onClick={() => handleRemove(item)}
                                                            disabled={isRemoving}
                                                            title="Remove this duplicate from the Ideas tab"
                                                            className="shrink-0 p-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60 transition-all disabled:opacity-50"
                                                        >
                                                            {isRemoving ? (
                                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <span
                                                            title="Already scheduled or published — protected from removal"
                                                            className="shrink-0 text-[8px] font-black uppercase tracking-wider text-slate-400 px-2 py-1 rounded-lg bg-slate-50 dark:bg-gray-900"
                                                        >
                                                            Protected
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Full searchable list */}
            <div className="mt-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <ListFilter className="w-4 h-4 text-indigo-500" />
                        All Tracked Content
                    </h3>
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto max-w-md">
                        <div className="flex p-1 bg-slate-100 dark:bg-gray-900 rounded-xl">
                            {(['all', 'ideas', 'schedule', 'website'] as const).map(src => (
                                <button
                                    key={src}
                                    onClick={() => setSourceFilter(src)}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                                        ${sourceFilter === src ? 'bg-white dark:bg-gray-800 text-slate-950 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                >
                                    {src}
                                </button>
                            ))}
                        </div>
                        <div className="relative w-full">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search titles..."
                                className="w-full bg-slate-100 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800 dark:text-white"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-950 border border-slate-150 dark:border-gray-850 rounded-2xl overflow-hidden shadow-sm max-h-[450px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-gray-900 border-b border-slate-150 dark:border-gray-800 sticky top-0">
                                <th className="py-3 px-5 text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Title</th>
                                <th className="py-3 px-5 text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider w-36">Category</th>
                                <th className="py-3 px-5 text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider w-36">Source</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-gray-900">
                            {filteredItems.map((item, index) => (
                                <tr key={item.id + '-' + index} className="hover:bg-slate-50/50 dark:hover:bg-gray-900/50 transition-colors">
                                    <td className="py-3 px-5">
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.title}</span>
                                    </td>
                                    <td className="py-3 px-5">
                                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">{item.category}</span>
                                    </td>
                                    <td className="py-3 px-5">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-widest
                                            bg-${sourceColor(item.source)}-50 text-${sourceColor(item.source)}-700 dark:bg-${sourceColor(item.source)}-950/30 dark:text-${sourceColor(item.source)}-400`}>
                                            {item.source}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-10 text-center text-xs font-bold text-slate-400">No items matched.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SheetAuditor;
