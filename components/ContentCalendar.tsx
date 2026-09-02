import React, { useState, useEffect, useMemo } from 'react';
import { fetchGoogleSheetData } from '../services/googleSheetsService';
import { 
    ChevronLeft, 
    ChevronRight, 
    Calendar as CalendarIcon, 
    Clock, 
    Tag, 
    ExternalLink, 
    RefreshCw, 
    CheckCircle2, 
    AlertCircle, 
    Sparkles, 
    BookOpen, 
    Plus, 
    FileText, 
    ArrowUpRight,
    Info
} from 'lucide-react';

const SHEET_ID = '116g8WqLHlWjjEXfavJVcUAzNvEKGCQ1-F38L8V76Ots';
const CALENDAR_SHEET_NAME = 'Blog Schedule';

interface ScheduledPost {
    title: string;
    category: string;
    publish_at_time: string;
    status: string;
    author: string;
    slug?: string;
}

interface ContentCalendarProps {
    onNavigate?: (tab: 'landing' | 'settings' | 'generate' | 'analyze' | 'upload' | 'gallery' | 'blog' | 'pipeline' | 'similarity' | 'trends' | 'balance' | 'calendar') => void;
}

const CATEGORY_STYLES: Record<string, { bg: string, text: string, border: string, dot: string }> = {
    'Auto Insurance': { bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800/60', dot: 'bg-blue-500' },
    'Home Insurance': { bg: 'bg-green-50 dark:bg-green-950/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800/60', dot: 'bg-green-500' },
    'Business Insurance': { bg: 'bg-purple-50 dark:bg-purple-950/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800/60', dot: 'bg-purple-500' },
    'Life Insurance': { bg: 'bg-red-50 dark:bg-red-950/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800/60', dot: 'bg-red-500' },
    'General Insurance': { bg: 'bg-orange-50 dark:bg-orange-950/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800/60', dot: 'bg-orange-500' },
    'Claims': { bg: 'bg-rose-50 dark:bg-rose-950/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800/60', dot: 'bg-rose-500' },
    'FAQ': { bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800/60', dot: 'bg-amber-500' },
    'Local Ohio Content': { bg: 'bg-indigo-50 dark:bg-indigo-950/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800/60', dot: 'bg-indigo-500' },
    'Seasonal': { bg: 'bg-teal-50 dark:bg-teal-950/20', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800/60', dot: 'bg-teal-500' }
};

const getCategoryStyle = (cat: string) => {
    return CATEGORY_STYLES[cat] || {
        bg: 'bg-slate-50 dark:bg-slate-800/40',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-200 dark:border-slate-700',
        dot: 'bg-slate-400'
    };
};

const WEEKDAY_TIPS: Record<number, { focus: string; advise: string }> = {
    0: { focus: "Life Insurance & Security Planning", advise: "Families review personal planning & deep-reflection topics on Sundays. Good for soft-sell life safety guides." },
    1: { focus: "Claims Walkthroughs & FAQs", advise: "Mondays find businesses and consumers planning their weekly tasks. Highly active for FAQ walkthroughs and claim reports." },
    2: { focus: "Auto & Home Insurance Sales", advise: "Engagement peaks on Tuesday afternoons for high-intent auto and home inquiries. Highly recommended to post practical coverage guides!" },
    3: { focus: "Business & Commercial Liability", advise: "Mid-week commercial planning is highly active. Great for business liability, worker's comp, or safety best practices." },
    4: { focus: "Seasonal Outings & Local Ohio", advise: "People prepare for weekend travel or weather changes on Thursdays. Perfect for Ohio road-trip guidelines or weather alerts." },
    5: { focus: "Safety Checklists & Handy Guides", advise: "Keep Friday posts light, actionable and highly visual. Quick maintenance checklists and home safety guides perform best." },
    6: { focus: "Local Community Highlights & FAQs", advise: "Saturdays are great for neighborhood safety updates or claims troubleshooting guides that families can read in spare time." }
};

// Year-Month-Day formatted safely from Date instance
const getLocalDateString = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Safe parser to bypass UTC offset shifts from standard sheet datetimes
const parsePostDateToKey = (dateStr: string): string | null => {
    if (!dateStr) return null;
    
    // Check direct ISO-like patterns "YYYY-MM-DD"
    const matchIso = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (matchIso) {
        const y = matchIso[1];
        const m = matchIso[2].padStart(2, '0');
        const d = matchIso[3].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    
    // Check standard US patterns "MM/DD/YYYY"
    const matchUs = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (matchUs) {
        const m = matchUs[1].padStart(2, '0');
        const d = matchUs[2].padStart(2, '0');
        const y = matchUs[3];
        return `${y}-${m}-${d}`;
    }

    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return getLocalDateString(parsed);
    }
    
    return null;
};

const ContentCalendar: React.FC<ContentCalendarProps> = ({ onNavigate }) => {
    const [posts, setPosts] = useState<ScheduledPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

    const fetchCalendarData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchGoogleSheetData(SHEET_ID, CALENDAR_SHEET_NAME);
            
            // Robust column value lookup to prevent incorrect index fallback mappings
            const findColumnValue = (row: any, possibleNames: string[], partialMatchKeyword?: string, excludeKeyword?: string): string | null => {
                const keys = Object.keys(row);
                // 1. Exact match first
                const exactKey = keys.find(k => {
                    const cleanKey = k.trim().toLowerCase();
                    return possibleNames.some(name => cleanKey === name.trim().toLowerCase());
                });
                if (exactKey !== undefined && row[exactKey] !== undefined && row[exactKey] !== null) {
                    return String(row[exactKey]).trim();
                }

                // 2. Partial match fallback (excluding unwanted descriptors like 'meta')
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

            const mappedPosts: ScheduledPost[] = data.map((row: any) => {
                const keys = Object.keys(row);
                
                const titleVal = findColumnValue(row, ['title', 'post', 'heading', 'blog title'], 'title', 'meta') || 
                                 (keys.length > 1 && keys[1].toLowerCase().includes('title') ? String(row[keys[1]]).trim() : 
                                  (keys.length > 0 ? String(row[keys[0]]).trim() : ''));
                                  
                const categoryVal = findColumnValue(row, ['category', 'type', 'genre', 'blog category'], 'category') || 
                                    (keys.length > 4 && row[keys[4]] ? String(row[keys[4]]).trim() : 'General Insurance');
                                    
                const dateVal = findColumnValue(row, ['publish time', 'publish_at_time', 'scheduled date', 'publish date', 'date'], 'publish') || 
                                findColumnValue(row, ['time', 'scheduled'], 'time') || 
                                (keys.length > 11 && row[keys[11]] ? String(row[keys[11]]).trim() : '');
                                
                const statusVal = findColumnValue(row, ['status', 'state', 'stage'], 'status') || 'Scheduled';
                const authorVal = findColumnValue(row, ['author', 'writer', 'by'], 'author') || '';
                const slugVal = findColumnValue(row, ['slug', 'url', 'link'], 'slug') || '';

                return {
                    title: titleVal,
                    category: categoryVal,
                    publish_at_time: dateVal,
                    status: statusVal,
                    author: authorVal,
                    slug: slugVal
                };
            }).filter((post: ScheduledPost) => post.title && post.title.toLowerCase() !== 'title' && post.title !== 'Untitled');
            
            setPosts(mappedPosts);
        } catch (err) {
            console.error("Calendar Fetch Error:", err);
            setError("Could not load schedule. Ensure a sheet named 'Blog Schedule' exists in your Google Spreadsheet.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCalendarData();
    }, []);

    // Calendar generation logic
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start on Sunday
    const endDate = new Date(monthEnd);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // End on Saturday

    const calendarDays = useMemo(() => {
        const days = [];
        const iterDate = new Date(startDate);
        while (iterDate <= endDate) {
            days.push(new Date(iterDate));
            iterDate.setDate(iterDate.getDate() + 1);
        }
        return days;
    }, [startDate, endDate]);

    const postsByDay = useMemo(() => {
        const map: Record<string, ScheduledPost[]> = {};
        posts.forEach(post => {
            if (!post.publish_at_time) return;
            const key = parsePostDateToKey(post.publish_at_time);
            if (!key) return;
            
            if (!map[key]) map[key] = [];
            map[key].push(post);
        });
        return map;
    }, [posts]);

    // Editorial Analytics calculations (for decision making support)
    const weekdayCoverage = useMemo(() => {
        const counts = [0, 0, 0, 0, 0, 0, 0]; // Sun to Sat
        posts.forEach(post => {
            if (!post.publish_at_time) return;
            const dateStr = parsePostDateToKey(post.publish_at_time);
            if (!dateStr) return;
            const postDate = new Date(dateStr + "T00:00:00");
            if (isNaN(postDate.getTime())) return;
            
            if (postDate.getMonth() === currentDate.getMonth() && postDate.getFullYear() === currentDate.getFullYear()) {
                counts[postDate.getDay()]++;
            }
        });
        return counts;
    }, [posts, currentDate]);

    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const emptyWeekdaysList = useMemo(() => {
        const gaps = [];
        for (let i = 0; i < 7; i++) {
            if (weekdayCoverage[i] === 0) {
                gaps.push(weekdayNames[i]);
            }
        }
        return gaps;
    }, [weekdayCoverage]);

    const nextMonth = () => {
        const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        setCurrentDate(next);
        setSelectedDate(next);
    };

    const prevMonth = () => {
        const prev = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        setCurrentDate(prev);
        setSelectedDate(prev);
    };

    const goToToday = () => {
        const today = new Date();
        setCurrentDate(today);
        setSelectedDate(today);
    };

    // Calculate metadata for the current selected date
    const selectedDateKey = selectedDate ? getLocalDateString(selectedDate) : '';
    const selectedDatePosts = selectedDate ? postsByDay[selectedDateKey] || [] : [];
    const hasSelectedPosts = selectedDatePosts.length > 0;
    const selectedDateTip = selectedDate ? WEEKDAY_TIPS[selectedDate.getDay()] : null;

    return (
        <div className="max-w-7xl mx-auto px-4 pb-20">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
                        <CalendarIcon className="w-8 h-8 text-orange-600 animate-pulse" />
                        Content Planning Studio
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest mt-1 block">
                        Editorial Planner & Smart Scheduling Engine
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={fetchCalendarData}
                        className="p-2.5 rounded-xl bg-slate-150 dark:bg-gray-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-750 transition-all font-bold flex items-center gap-1 text-[10px] uppercase tracking-wider"
                        title="Sync Live Schedule"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>{isLoading ? 'Syncing...' : 'Sync Sheet'}</span>
                    </button>
                    <div className="bg-slate-100 dark:bg-gray-900 p-1.5 rounded-2xl flex items-center gap-1 shadow-inner border border-slate-250/20 dark:border-gray-800">
                        <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-white dark:hover:bg-gray-850 text-slate-600 dark:text-slate-400 transition-all font-bold">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={goToToday} className="px-4 py-2 rounded-xl hover:bg-white dark:hover:bg-gray-850 text-slate-900 dark:text-white transition-all text-xs font-black uppercase tracking-widest">
                            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </button>
                        <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-white dark:hover:bg-gray-850 text-slate-600 dark:text-slate-400 transition-all font-bold">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-900/50 p-6 rounded-3xl mb-8 flex items-start gap-4">
                    <div className="bg-red-100 dark:bg-red-900 p-2 rounded-xl text-red-600 dark:text-red-400">
                        <ExternalLink className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-red-900 dark:text-red-100 font-black uppercase text-[10px] tracking-widest mb-1">Spreadsheet Fetch Alert</h4>
                        <p className="text-red-700 dark:text-red-300 text-sm font-bold">{error}</p>
                        <button onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${SHEET_ID}`, '_blank')} className="mt-4 text-xs font-black uppercase text-red-600 underline tracking-widest">Open Spreadsheet</button>
                    </div>
                </div>
            )}

            {/* Smart Editorial Top Banner: decision support bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 dark:from-emerald-950/20 dark:to-teal-950/5 border border-emerald-100 dark:border-emerald-900/40 p-4 rounded-2xl flex items-center gap-3">
                    <div className="p-3 bg-emerald-500 rounded-xl text-white">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Green Corners</span>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">Days with Scheduled Blogs</h4>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-gray-900/40 border border-slate-200 dark:border-gray-800 p-4 rounded-2xl flex items-center gap-3">
                    <div className="p-3 bg-slate-300 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300">
                        <Plus className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Dashed Areas</span>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">Empty slots (Open Opportunities)</h4>
                    </div>
                </div>
                <div className="bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-900/20 p-4 rounded-2xl flex items-center gap-3 md:col-span-2">
                    <div className="p-3 bg-orange-600 rounded-xl text-white">
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">Coverage Gaps ({getLocalDateString(currentDate).substring(0,7)})</span>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                            {emptyWeekdaysList.length > 0 ? (
                                <span>No posts scheduled on: <strong className="text-orange-600 dark:text-orange-400">{emptyWeekdaysList.join(', ')}</strong></span>
                            ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Excellent! All weekdays have posts planned this month.</span>
                            )}
                        </h4>
                    </div>
                </div>
            </div>

            {/* Main Double Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Side: Interactive Calendar Grid */}
                <div className="lg:col-span-8 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-[2rem] overflow-hidden shadow-xl flex flex-col min-h-[700px]">
                    
                    {/* Weekday Titles */}
                    <div className="grid grid-cols-7 border-b border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950/50">
                        {weekdayNames.map(day => (
                            <div key={day} className="py-4 text-center text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] truncate px-1">
                                {day.substring(0, 3)}
                            </div>
                        ))}
                    </div>

                    {/* Day Grid */}
                    <div className="grid grid-cols-7 flex-grow">
                        {calendarDays.map((date, idx) => {
                            const dateKey = getLocalDateString(date);
                            const dayPosts = postsByDay[dateKey] || [];
                            const hasPosts = dayPosts.length > 0;
                            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                            const isToday = new Date().toDateString() === date.toDateString();
                            const isSelected = selectedDate && getLocalDateString(selectedDate) === dateKey;

                            return (
                                <div 
                                    key={idx} 
                                    onClick={() => setSelectedDate(date)}
                                    className={`min-h-[140px] p-2 border-b border-r border-slate-100 dark:border-gray-800 transition-all cursor-pointer relative overflow-hidden flex flex-col pt-3
                                    ${!isCurrentMonth ? 'bg-slate-50/30 dark:bg-gray-950/5 text-slate-300 dark:text-slate-700' : 'bg-white dark:bg-gray-900'}
                                    ${isToday ? 'bg-orange-50/20 dark:bg-orange-950/5' : ''}
                                    ${isSelected ? 'ring-2 ring-orange-500 bg-slate-100/50 dark:bg-gray-850/80' : ''}
                                    ${hasPosts ? 'hover:bg-slate-50 dark:hover:bg-gray-800/40' : 'hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10'}
                                    `}
                                >
                                    {/* 1. Green Triangle Notification in Top Right Corner (Only if day has scheduled posts) */}
                                    {hasPosts && (
                                        <div 
                                            className="absolute top-0 right-0 w-0 h-0 border-t-[16px] border-l-[16px] border-t-emerald-500 border-l-transparent dark:border-t-emerald-400 z-10"
                                            title={`${dayPosts.length} posts scheduled`}
                                        />
                                    )}

                                    {/* Day Number */}
                                    <div className="flex justify-between items-center mb-1.5 px-0.5">
                                        <span className={`text-[11px] font-black p-1 min-w-[22px] h-5 flex items-center justify-center rounded-md
                                            ${!isCurrentMonth ? 'text-slate-300 dark:text-slate-700' : 'text-slate-600 dark:text-slate-400'}
                                            ${isToday ? 'bg-orange-600 text-white shadow-md font-bold' : ''}
                                            ${isSelected ? 'border border-orange-500' : ''}`}>
                                            {date.getDate()}
                                        </span>
                                        {hasPosts && (
                                            <span className="text-[7.5px] font-black text-emerald-600 dark:text-emerald-450 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/30 px-1 py-0.5 rounded">
                                                {dayPosts.length} Post{dayPosts.length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>

                                    {/* Posts or Empty Slot Indicator */}
                                    <div className="space-y-1.5 flex-grow">
                                        {hasPosts ? (
                                            dayPosts.map((post, pIdx) => {
                                                const cStyle = getCategoryStyle(post.category);
                                                return (
                                                    <div 
                                                        key={pIdx}
                                                        className={`p-1.5 rounded-lg border ${cStyle.border} ${cStyle.bg} shadow-sm transition-all hover:scale-[1.01]`}
                                                    >
                                                        <div className="flex items-center gap-1.5 mb-1 truncate">
                                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cStyle.dot}`} />
                                                            <span className={`text-[7.5px] font-black uppercase tracking-wider ${cStyle.text} truncate`}>
                                                                {post.category}
                                                            </span>
                                                        </div>
                                                        <h5 className="text-[9px] font-bold text-slate-800 dark:text-slate-200 leading-tight line-clamp-2">
                                                            {post.title}
                                                        </h5>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            isCurrentMonth && (
                                                <div className="absolute inset-x-2 bottom-2 border border-dashed border-slate-150 dark:border-gray-800/80 rounded-xl p-2 flex items-center justify-center pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
                                                    <span className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Empty Slot</span>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Side: Interactive Editorial Planner & Decision Analytics */}
                <div className="lg:col-span-4 space-y-6">
                    
                    {/* Active Selected Date Card */}
                    <div className="bg-white dark:bg-gray-905 border border-slate-200 dark:border-gray-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-2 h-full bg-orange-600" />
                        
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full">
                                Selected Date
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${hasSelectedPosts ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-200 dark:border-emerald-900/50' : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 border border-amber-200 dark:border-amber-900/50'}`}>
                                {hasSelectedPosts ? '● Scheduled Slot' : '○ Vacant Slot'}
                            </span>
                        </div>

                        <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight mb-2 tracking-tight">
                            {selectedDate ? selectedDate.toLocaleDateString('default', {
                                weekday: 'long', 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                            }) : 'No Date Selected'}
                        </h3>

                        <hr className="border-slate-100 dark:border-gray-800 my-4" />

                        {hasSelectedPosts ? (
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                    Planned Content ({selectedDatePosts.length} post{selectedDatePosts.length > 1 ? 's' : ''})
                                </h4>
                                {selectedDatePosts.map((post, idx) => {
                                    const cStyle = getCategoryStyle(post.category);
                                    return (
                                        <div key={idx} className="p-4 rounded-2xl border border-slate-150 dark:border-gray-800 bg-slate-50 dark:bg-gray-950/30 space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border shrink-0 ${cStyle.border} ${cStyle.bg} ${cStyle.text}`}>
                                                    {post.category}
                                                </div>
                                                <span className="text-[9px] font-bold bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 shadow-sm shrink-0">
                                                    {post.status || 'Draft'}
                                                </span>
                                            </div>

                                            <p className="text-xs font-extrabold text-slate-900 dark:text-white leading-normal">
                                                {post.title}
                                            </p>

                                            <div className="pt-2 border-t border-slate-150 dark:border-gray-800 flex flex-wrap items-center justify-between text-[9px] font-black uppercase text-slate-400 gap-2">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span>
                                                        {post.publish_at_time ? (
                                                            new Date(post.publish_at_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                        ) : 'Anytime'}
                                                    </span>
                                                </div>
                                                {post.author && (
                                                    <span>By: {post.author}</span>
                                                )}
                                            </div>
                                            
                                            {post.slug && (
                                                <div className="text-[9px] font-mono text-slate-500 truncate dark:text-slate-400 bg-white dark:bg-gray-900 px-2 py-1 rounded">
                                                    /{post.slug}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-gray-800 bg-amber-500/5 text-center py-6">
                                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-950/20 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-600">
                                        <Info className="w-5 h-5" />
                                    </div>
                                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-205 tracking-wider">No Blogs Scheduled</h4>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-1 font-bold">
                                        This provides an ideal, vacant posting slot. Plan something!
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Interactive intelligence tip according to weekday selection */}
                        {selectedDateTip && (
                            <div className="mt-5 p-4 rounded-2xl bg-gradient-to-tr from-orange-50/30 to-orange-100/10 dark:from-orange-950/10 dark:to-transparent border border-orange-100 dark:border-orange-900/30">
                                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-2">
                                    <Sparkles className="w-4 h-4" />
                                    <span className="text-[9px] font-black uppercase tracking-wider">Engagement Insight</span>
                                </div>
                                <h5 className="text-[11px] font-black text-slate-800 dark:text-slate-200 mb-1">
                                    Recommended: {selectedDateTip.focus}
                                </h5>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-normal">
                                    {selectedDateTip.advise}
                                </p>
                            </div>
                        )}

                        {/* Quick actions inside panel to schedule */}
                        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-gray-800 space-y-3">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">Scheduling actions</span>
                            {onNavigate && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => onNavigate('blog')}
                                        className="py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[9px] tracking-wider transition-all flex items-center justify-center gap-1 shadow-md"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Build Blog</span>
                                    </button>
                                    <button 
                                        onClick={() => onNavigate('pipeline')}
                                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-750 text-slate-800 dark:text-slate-200 font-black uppercase text-[9px] tracking-wider transition-all flex items-center justify-center gap-1 border border-slate-200 dark:border-gray-700"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>Open Pipeline</span>
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${SHEET_ID}`, '_blank')}
                                className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-black uppercase text-[8.5px] tracking-widest transition-all text-center flex items-center justify-center gap-1"
                            >
                                <span>Go to Google Sheet</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Weekday Distribution Tracker */}
                    <div className="bg-white dark:bg-gray-905 border border-slate-200 dark:border-gray-800 rounded-3xl p-6 shadow-xl space-y-4">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-orange-600" />
                            <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest">
                                Monthly Post Spacing
                            </h4>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-440 font-bold leading-relaxed">
                            Maintain consistent publishing coverage. Aim for at least one active blog per weekday to maximize SEO performance.
                        </p>

                        <div className="space-y-2.5 pt-2">
                            {weekdayNames.map((name, i) => {
                                const count = weekdayCoverage[i];
                                const maxCount = Math.max(...weekdayCoverage, 1);
                                const percent = (count / maxCount) * 100;
                                const isCurrentDateDay = selectedDate && selectedDate.getDay() === i;

                                return (
                                    <div key={name} className={`space-y-1 p-1 px-2 rounded-lg transition-colors ${isCurrentDateDay ? 'bg-orange-50/30 dark:bg-orange-950/10 border border-orange-100/30 dark:border-orange-900/10' : ''}`}>
                                        <div className="flex items-center justify-between text-[10px] font-black uppercase">
                                            <span className="text-slate-600 dark:text-slate-400">{name}</span>
                                            <span className={count > 0 ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                                                {count} {count === 1 ? 'post' : 'posts'}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${count > 0 ? 'bg-emerald-500' : 'bg-slate-350 dark:bg-slate-700'}`}
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>

            {/* Bottom Color Scheme Legend */}
            <div className="mt-12 flex flex-wrap gap-4 items-center justify-center pt-8 border-t border-slate-100 dark:border-gray-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">Topic Category Legend:</span>
                {Object.entries(CATEGORY_STYLES).map(([cat, style]) => (
                    <div key={cat} className="flex items-center gap-2 px-3.5 py-1.5 bg-white dark:bg-gray-800 rounded-full border border-slate-200 dark:border-gray-700 shadow-sm transition-all hover:scale-[1.03]">
                        <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">{cat}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContentCalendar;
