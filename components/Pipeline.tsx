
import React, { useEffect, useState, useMemo } from 'react';
import { fetchGoogleSheetData } from '../services/googleSheetsService';
import { ChevronDown, ChevronUp, Play, CheckCircle2, Send, Clock, AlertCircle, Plus, X, Type, Tag, Calendar, Terminal, Settings, Database, Scale, BarChart2 } from 'lucide-react';
import { SUPABASE_CONFIG } from '../services/config';
import { savePipelineItem, fetchPipelineItems, updatePipelineStatus, archivePipelineItem, PipelineItem as SupaPipelineItem } from '../services/pipelinePersistence';
import { calculateSimilarity, analyzeBalance, CategoryGoal } from '../services/intelligenceService';
import { fetchPosts } from '../services/postService';

const SHEET_ID = '116g8WqLHlWjjEXfavJVcUAzNvEKGCQ1-F38L8V76Ots';
const SHEET_NAME = 'Future_Blog_Ideas_Copied';

const CATEGORIES = [
    'Auto Insurance', 
    'Home Insurance', 
    'Business Insurance', 
    'Life Insurance', 
    'General Insurance',
    'Claims',
    'FAQ',
    'Local Ohio Content',
    'Seasonal'
];

const POSTING_TIMES = ['Anytime', 'Morning', 'Afternoon', 'Evening'];
const STATUSES = ['NOT STARTED', 'In Progress', 'Still Reviewing', 'Approved', 'Uploaded for Publishing'];

interface PipelineItem {
    Title: string;
    Category: string;
    'Best Posting Time': string;
    Prompt: string;
    Status: string;
    Timestamp: string;
}

interface PipelineProps {
    onBlogThis: (data: { 
        title: string, 
        category: string, 
        prompt: string,
        bestPostingTime?: string,
        timestamp?: string
    }) => void;
    onNavigate?: (tab: 'landing' | 'settings' | 'generate' | 'analyze' | 'upload' | 'gallery' | 'blog' | 'voiceover' | 'pipeline' | 'trends' | 'calendar' | 'auditor') => void;
}

type SyncState = 'idle' | 'loading' | 'success' | 'error';

const Pipeline: React.FC<PipelineProps> = ({ onBlogThis, onNavigate }) => {
    const [items, setItems] = useState<PipelineItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newItem, setNewItem] = useState<Partial<PipelineItem>>({
        Status: 'NOT STARTED',
        'Best Posting Time': 'Anytime',
        Category: 'General Insurance'
    });
    
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        'NOT STARTED': true,
        'In Progress': true,
        'Still Reviewing': true,
        'Approved': true,
        'Uploaded for Publishing': false
    });
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [syncState, setSyncState] = useState<SyncState>('idle');
    const [expandedItem, setExpandedItem] = useState<string | null>(null);
    const [showInstructions, setShowInstructions] = useState(false);
    const [balanceStats, setBalanceStats] = useState<CategoryGoal[]>([]);
    const [similarityWarning, setSimilarityWarning] = useState<{ title: string, score: number } | null>(null);
    const [allHistoricalTitles, setAllHistoricalTitles] = useState<string[]>([]);
    const [similarityResults, setSimilarityResults] = useState<{title: string, score: number}[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanPerformed, setScanPerformed] = useState(false);

    // Form Persistence: Load draft from localStorage on mount
    useEffect(() => {
        const draft = localStorage.getItem('pipeline_add_draft');
        if (draft) {
            try {
                const parsed = JSON.parse(draft);
                setNewItem(prev => ({
                    ...prev,
                    ...parsed
                }));
            } catch (e) {
                console.error("Failed to parse pipeline draft", e);
            }
        }
    }, []);

    // Form Persistence: Save draft to localStorage whenever newItem changes
    useEffect(() => {
        if (newItem.Title || (newItem.Prompt && newItem.Prompt.length > 20)) {
            localStorage.setItem('pipeline_add_draft', JSON.stringify(newItem));
        } else if (newItem.Title === '' && (newItem.Prompt === '' || !newItem.Prompt)) {
            localStorage.removeItem('pipeline_add_draft');
        }
    }, [newItem]);

    const APPS_SCRIPT_CODE = `/**
 * BIGINSURED CONTENT STUDIO - SYNC LOGIC
 * Safely add this to your existing code. If you already have a doPost(e) function,
 * simply copy the logic inside handleStudioRequest(params) into your existing script.
 */

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    
    // Safety Check: Only process requests from the Studio App
    if (params.appSource === "BigInsured_Studio") {
      return handleStudioRequest(params);
    }
    
    // If you have other scripts, you can handle them here...
    return ContentService.createTextOutput("Ignored: Request source unknown").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Modular logic to handle Content Studio operations
 */
function getLastPopulatedRow(sheet) {
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (values[i] && (values[i][0] !== "" || (values[i][1] !== "" && values[i][1] !== undefined))) {
      return i + 1;
    }
  }
  return 0;
}

function handleStudioRequest(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "Future_Blog_Ideas_Copied"; // Dedicated tab for this app
  
  // ACTION: Delete a row from the Ideas tab (used by Content Audit's
  // "Remove duplicate" button — only ever targets Future_Blog_Ideas_Copied,
  // never Blog Schedule, so already-published/scheduled content is never touched).
  if (params.type === "delete_row") {
    var dSheet = ss.getSheetByName(sheetName);
    if (!dSheet) return ContentService.createTextOutput("Error: Sheet not found");
    var dData = dSheet.getDataRange().getValues();
    for (var k = 1; k < dData.length; k++) {
      // Match by exact Title (Column A) AND row number for safety,
      // so we never delete the wrong row if titles repeat.
      if (dData[k][0] === params.title && (k + 1) === params.rowNumber) {
        dSheet.deleteRow(k + 1);
        return ContentService.createTextOutput("Success: Deleted").setMimeType(ContentService.MimeType.TEXT);
      }
    }
    return ContentService.createTextOutput("Error: Row not found or already removed").setMimeType(ContentService.MimeType.TEXT);
  }

  // ACTION: Add to Pipeline
  if (params.type === "add_content") {
    var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    var targetRow = getLastPopulatedRow(sheet);
    if (targetRow === 0) {
      sheet.appendRow(["Title", "Category", "Best Posting Time", "Prompt", "Status", "TimeStamp"]);
      sheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#f3f3f3");
      targetRow = 1;
    }
    sheet.getRange(targetRow + 1, 1, 1, 6).setValues([[
      params.Title,
      params.Category || "General Insurance",
      params['Best Posting Time'] || "Anytime",
      params.Prompt || "",
      params.Status || "NOT STARTED",
      params.Timestamp || new Date().toLocaleString()
    ]]);
    return ContentService.createTextOutput("Success: Added").setMimeType(ContentService.MimeType.TEXT);
  }
  
  // ACTION: Update Pipeline Status
  if (params.type === "status_update") {
     var sheet = ss.getSheetByName(sheetName);
     if (!sheet) return ContentService.createTextOutput("Error: Sheet not found");
     var data = sheet.getDataRange().getValues();
     for (var i = 1; i < data.length; i++) {
       // Match by Title (Column A)
       if (data[i][0] === params.title) {
         sheet.getRange(i + 1, 5).setValue(params.status); // Column E is Status
         break;
       }
     }
     return ContentService.createTextOutput("Success: Updated").setMimeType(ContentService.MimeType.TEXT);
  }

  // ACTION: Port to Published Schedule
  if (params.type === "port_to_schedule") {
    var scheduleSheet = ss.getSheetByName("Blog Schedule") || ss.insertSheet("Blog Schedule");
    var sTargetRow = getLastPopulatedRow(scheduleSheet);
    if (sTargetRow === 0) {
      scheduleSheet.appendRow(["Title", "Category", "Scheduled Date", "Status", "Slug", "SEO Score"]);
      scheduleSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#f3f3f3");
      sTargetRow = 1;
    }
    scheduleSheet.getRange(sTargetRow + 1, 1, 1, 6).setValues([[
      params.title,
      params.category,
      params.publishDate,
      "Draft",
      params.slug,
      params.seoScore
    ]]);

    // SYNC BACK: Also update the status in the pipeline if identified
    var pSheet = ss.getSheetByName(sheetName);
    if (pSheet) {
      var pData = pSheet.getDataRange().getValues();
      for (var j = 1; j < pData.length; j++) {
        // Match by Title (Column A) or Original Pipeline Title
        if (pData[j][0] === (params.pipeline_title || params.title)) {
          pSheet.getRange(j + 1, 5).setValue("Uploaded for Publishing");
          break;
        }
      }
    }
    return ContentService.createTextOutput("Success: Ported").setMimeType(ContentService.MimeType.TEXT);
  }
}`;

    const loadData = async () => {
        setSyncState('loading');
        if (items.length === 0) setIsLoading(true);
        try {
            // 1. Fetch from Supabase (Primary Source for Persistence)
            let supaItems: PipelineItem[] = [];
            let postsData: any[] = [];
            try {
                const [dbItems, fetchedPosts] = await Promise.all([
                    fetchPipelineItems(),
                    fetchPosts()
                ]);
                postsData = fetchedPosts;
                supaItems = dbItems.map(di => ({
                    Title: di.title,
                    Category: di.category,
                    'Best Posting Time': di.best_posting_time,
                    Prompt: di.prompt,
                    Status: di.status,
                    Timestamp: di.timestamp
                }));
            } catch (dbErr) {
                console.warn('Supabase fetch failed, relying on Google Sheets:', dbErr);
            }

            // 2. Fetch from Google Sheets (Backup source)
            let sheetMappedData: PipelineItem[] = [];
            try {
                const sheetData = await fetchGoogleSheetData(SHEET_ID, SHEET_NAME);
                sheetMappedData = sheetData.map((row: any) => {
                    const findValue = (possibleKeys: string[]) => {
                        const foundKey = Object.keys(row).find(k => 
                            possibleKeys.some(pk => k.toLowerCase().trim() === pk.toLowerCase().trim())
                        );
                        return foundKey ? row[foundKey] : null;
                    };

                    return {
                        Title: findValue(['Title', 'blog_title']) || '',
                        Category: findValue(['Category', 'category']) || 'General',
                        'Best Posting Time': findValue(['Best Posting Time', 'posting_time']) || '',
                        Prompt: findValue(['Prompt', 'prompt', 'instructions']) || '',
                        Status: (findValue(['Status', 'status']) || 'NOT STARTED').trim().toUpperCase() === 'UPLOADED FOR PUBLISHING' ? 'Uploaded for Publishing' : (findValue(['Status', 'status']) || 'NOT STARTED'),
                        Timestamp: findValue(['TimeStamp', 'timestamp', 'generated_at']) || '',
                    } as PipelineItem;
                }).filter(item => item.Title);
            } catch (sheetErr) {
                console.warn('Google Sheet pipeline fetch failed:', sheetErr);
            }
            
            // 3. Merge: Use Supabase items and add any missing ones from Sheets
            // If a title exists in both, Supabase is the truth for status (since it's instant)
            const merged = [...supaItems];
            sheetMappedData.forEach(si => {
                const existsInSupa = merged.some(mi => mi.Title.toLowerCase() === si.Title.toLowerCase());
                if (!existsInSupa) {
                    merged.push(si);
                    // Automatically back-sync new Sheet items to Supabase
                    savePipelineItem({
                        title: si.Title,
                        category: si.Category,
                        best_posting_time: si['Best Posting Time'],
                        prompt: si.Prompt,
                        status: si.Status,
                        timestamp: si.Timestamp
                    }).catch(() => {});
                }
            });

            setItems(merged);
            
            // 4. Set Historical Titles for Similarity Checker
            const historicalTitles = Array.from(new Set([
                ...postsData.flatMap(p => [p.title, p.original_title]),
                ...merged.map(m => m.Title)
            ])).filter(Boolean).map(t => String(t).trim());
            setAllHistoricalTitles(historicalTitles);

            // 5. Calculate Balance Stats
            const allTitlesData = [...postsData, ...merged].map(i => ({ 
                title: 'title' in i ? i.title : (i as PipelineItem).Title, 
                category: 'category' in i ? i.category : (i as PipelineItem).Category 
            }));
            const stats = analyzeBalance(allTitlesData);
            setBalanceStats(stats);

            setError(null);
            setSyncState('success');
            setTimeout(() => setSyncState('idle'), 3000);
        } catch (err) {
            console.error('Pipeline data fetch error:', err);
            setError(`Failed to load pipeline data.`);
            setSyncState('error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleClearForm = (e?: React.MouseEvent) => {
        if (e) e.preventDefault();
        
        if (window.confirm("Are you sure you want to clear this draft? This will reset all fields.")) {
            // 1. Explicitly remove from storage first
            localStorage.removeItem('pipeline_add_draft');
            
            // 2. Clear state with fresh values
            const emptyItem = {
                Status: 'NOT STARTED',
                'Best Posting Time': 'Anytime',
                Category: 'General Insurance',
                Title: '',
                Prompt: ''
            };
            
            setNewItem(emptyItem);
            setSimilarityWarning(null);
            
            // 3. Close and reopen modal to force UI refresh if needed (optional but helps reliability)
            console.log("Draft cleared successfully");
        }
    };

    const handleAddContent = async (e: React.FormEvent) => {
        if (e) e.preventDefault();
        const webhookUrl = localStorage.getItem('google_sheets_webhook_url') || SUPABASE_CONFIG.GOOGLE_SHEETS_WEBHOOK_URL;
        
        if (!newItem.Title) {
            alert('Title is required');
            return;
        }

        // Final safety check
        if (similarityResults.length > 0 && similarityResults[0].score > 85 && !similarityWarning) {
            setSimilarityWarning(similarityResults[0]);
            return;
        }

        const timestamp = new Date().toLocaleString('en-US', { 
            month: 'numeric', day: 'numeric', year: 'numeric', 
            hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true 
        });

        const fullItem: PipelineItem = {
            Title: newItem.Title,
            Category: newItem.Category || 'General Insurance',
            'Best Posting Time': newItem['Best Posting Time'] || 'Anytime',
            Prompt: newItem.Prompt || getDefaultPrompt(newItem.Title, newItem.Category || 'General Insurance'),
            Status: newItem.Status || 'NOT STARTED',
            Timestamp: timestamp
        };

        setSyncState('loading');
        try {
            // 1. Save to Supabase (Instant Persistence)
            await savePipelineItem({
                title: fullItem.Title,
                category: fullItem.Category,
                best_posting_time: fullItem['Best Posting Time'],
                prompt: fullItem.Prompt,
                status: fullItem.Status,
                timestamp: fullItem.Timestamp
            });

            // 2. Try to sync to Sheets (Legacy backup)
            if (webhookUrl) {
                fetch(webhookUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        type: 'add_content',
                        appSource: 'BigInsured_Studio',
                        ...fullItem
                    })
                }).catch(err => console.error('Sheet sync failed but Supabase saved:', err));
            }

            setItems(prev => [fullItem, ...prev]);
            setSyncState('success');
            
            // Show success state on button before closing
            setTimeout(() => {
                setShowAddModal(false);
                setSyncState('idle');
                setSimilarityWarning(null);
                setScanPerformed(false);
                setSimilarityResults([]);
                setNewItem({
                    Status: 'NOT STARTED',
                    'Best Posting Time': 'Anytime',
                    Category: 'General Insurance',
                    Title: '',
                    Prompt: ''
                });
                // Ensure storage is wiped after success
                localStorage.removeItem('pipeline_add_draft');
                // Refresh data
                loadData();
            }, 800);
        } catch (err) {
            console.error('Add content error:', err);
            setSyncState('error');
            setTimeout(() => setSyncState('idle'), 3000);
            alert('Failed to save to database. Check your connection.');
        }
    };

    const getDefaultPrompt = (title: string, category: string) => {
        return `Write a 1,200-1,800 word blog post about: "${title}"

Category: ${category}
Target Audience: Progressive and informed Central Ohio residents.

Core Focus:
- Breakdown how this relates to Ohio and the Central Ohio Area specifically.
- Include a section for "Our Take" on how we see this from an 40+ year agency perspective.

Requirements:
- SEO-optimized with natural keyword usage.
- Educational but conversational tone (like a trusted neighbor).
- Clear H2/H3 headers and short, punchy paragraphs.
- Strong call-to-action at the end.

Output: Complete blog post ready to publish.`;
    };

    const runSimilarityScan = () => {
        if (!newItem.Title?.trim()) return;
        setIsScanning(true);
        
        setTimeout(() => {
            const results = allHistoricalTitles.map(t => ({
                title: t,
                score: Math.round(calculateSimilarity(newItem.Title!, t) * 100)
            }))
            .filter(r => r.score > 10)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

            setSimilarityResults(results);
            setIsScanning(false);
            setScanPerformed(true);
        }, 300);
    };

    const avgSimilarity = useMemo(() => {
        if (similarityResults.length === 0) return 0;
        return Math.round(similarityResults.reduce((acc, r) => acc + r.score, 0) / similarityResults.length);
    }, [similarityResults]);

    const toggleSection = (status: string) => {
        setOpenSections(prev => ({ ...prev, [status]: !prev[status] }));
    };

    const updateStatus = async (item: PipelineItem, newStatus: string) => {
        const webhookUrl = localStorage.getItem('google_sheets_webhook_url') || SUPABASE_CONFIG.GOOGLE_SHEETS_WEBHOOK_URL;
        
        setUpdatingId(item.Title);
        setSyncState('loading');
        try {
            // 1. Update Supabase first (Master Source)
            await updatePipelineStatus(item.Title, newStatus);

            // 2. Sync to Google Sheets
            if (webhookUrl) {
                fetch(webhookUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        type: 'status_update',
                        appSource: 'BigInsured_Studio',
                        title: item.Title,
                        status: newStatus,
                        timestamp: new Date().toISOString()
                    })
                }).catch(err => console.error('Sheet status sync failed but Supabase updated:', err));
            }

            // Optimistic UI update
            setItems(prev => prev.map(i => i.Title === item.Title ? { ...i, Status: newStatus } : i));
            
            // Show success briefly
            setSyncState('success');
            setTimeout(() => setSyncState('idle'), 2000);
        } catch (err) {
            console.error('Status update error:', err);
            setSyncState('error');
            setTimeout(() => setSyncState('idle'), 3000);
        } finally {
            setUpdatingId(null);
        }
    };

    const handlePortToBlogBuild = (item: PipelineItem) => {
        // Record for history
        archivePipelineItem({
            title: item.Title,
            category: item.Category,
            best_posting_time: item['Best Posting Time'],
            prompt: item.Prompt,
            status: item.Status,
            timestamp: item.Timestamp
        }).catch(err => console.error("Failed to archive:", err));

        onBlogThis({
            title: item.Title,
            category: item.Category,
            prompt: item.Prompt,
            bestPostingTime: item['Best Posting Time'],
            timestamp: item.Timestamp
        });
    };

    const getStatusButtons = (item: PipelineItem) => {
        const isUpdating = updatingId === item.Title;

        switch (item.Status) {
            case 'NOT STARTED':
                return (
                    <button 
                        disabled={isUpdating}
                        onClick={() => updateStatus(item, 'In Progress')}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                        {isUpdating ? <Clock className="w-3 h-3 animate-spin"/> : <Play className="w-3 h-3" />}
                        Start Progression
                    </button>
                );
            case 'In Progress':
                return (
                    <div className="flex gap-2">
                        <button 
                            disabled={isUpdating}
                            onClick={() => updateStatus(item, 'Still Reviewing')}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                        >
                            Still Reviewing
                        </button>
                        <button 
                            disabled={isUpdating}
                            onClick={() => updateStatus(item, 'Approved')}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                        >
                            Approved
                        </button>
                    </div>
                );
            case 'Still Reviewing':
                return (
                    <button 
                        disabled={isUpdating}
                        onClick={() => updateStatus(item, 'Approved')}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                        Mark Approved
                    </button>
                );
            case 'Approved':
                return (
                    <div className="flex gap-2">
                        <button 
                            onClick={() => handlePortToBlogBuild(item)}
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                        >
                            <Send className="w-3 h-3" />
                            Send to Blog Build
                        </button>
                        <button 
                            disabled={isUpdating}
                            onClick={() => updateStatus(item, 'Uploaded for Publishing')}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                        >
                            {isUpdating ? <Clock className="w-3 h-3 animate-spin"/> : <CheckCircle2 className="w-3 h-3" />}
                            Mark Uploaded
                        </button>
                    </div>
                );
            default:
                return null;
        }
    };

    const columns = [
        { label: 'NOT STARTED', status: 'NOT STARTED', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' },
        { label: 'In Progress', status: 'In Progress', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
        { label: 'Still Reviewing', status: 'Still Reviewing', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/20' },
        { label: 'Approved', status: 'Approved', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20' },
        { label: 'Uploaded for Publishing', status: 'Uploaded for Publishing', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20' }
    ];

    if (isLoading && items.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto p-4">
            {/* Category Balance Summary Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
                {balanceStats.slice(0, 5).map(stat => (
                    <div key={stat.category} className="bg-gray-900/50 border border-gray-800 p-4 rounded-2xl flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[80px]">{stat.category}</span>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                                stat.priority.includes('🔴') ? 'bg-red-500/20 text-red-500' :
                                stat.priority.includes('✅') ? 'bg-green-500/20 text-green-500' :
                                'bg-orange-500/20 text-orange-500'
                            }`}>
                                {stat.priority.split(' ')[1] || stat.priority}
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-white">{stat.current}</span>
                            <span className="text-[10px] font-bold text-slate-600">/ {stat.goal}</span>
                        </div>
                        <div className="mt-3 h-1 w-full bg-gray-950 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-1000 ${stat.priority.includes('🔴') ? 'bg-red-500' : 'bg-orange-600'}`}
                                style={{ width: `${stat.progress}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <span className="w-2 h-8 bg-orange-600 rounded-full"></span>
                    Content Pipeline
                </h2>
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => setShowInstructions(true)}
                        className="flex items-center gap-2 bg-gray-900 border border-gray-800 hover:border-blue-500 text-slate-400 hover:text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        Sync Config
                    </button>

                    <button 
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        Add Content
                    </button>

                    {onNavigate && (
                        <button 
                            onClick={() => window.open(`${window.location.origin}${window.location.pathname}?tab=calendar`, '_blank')}
                            className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-orange-500 text-slate-300 hover:text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
                        >
                            <Calendar className="w-4 h-4" />
                            View Content Calendar
                        </button>
                    )}
                    
                    <div className="flex items-center gap-4 border-l border-gray-800 pl-6">
                        {syncState === 'success' && (
                        <span className="text-green-500 text-[10px] font-black uppercase tracking-widest animate-pulse flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Updated Sheet
                        </span>
                    )}
                    {syncState === 'error' && (
                        <span className="text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Update Failed
                        </span>
                    )}
                    <button 
                        onClick={loadData}
                        disabled={isLoading}
                        className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-gray-800 hover:border-orange-500 transition-all ${syncState === 'loading' ? 'bg-orange-500 text-white' : 'bg-gray-900 text-slate-400'}`}
                    >
                        {isLoading ? 'Syncing...' : 'Refresh Pipeline'}
                    </button>
                    </div>
                </div>
            </div>

            {/* Sync Instructions Modal */}
            {showInstructions && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
                    <div className="bg-gray-950 border border-blue-500/30 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden shadow-blue-900/10">
                        <div className="flex justify-between items-center p-8 bg-blue-600/10 border-b border-blue-500/20">
                            <div className="flex items-center gap-4">
                                <Settings className="w-6 h-6 text-blue-500" />
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Sync Configuration</h3>
                                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-1">Make your data permanent across browsers</p>
                                </div>
                            </div>
                            <button onClick={() => setShowInstructions(false)} className="p-2 hover:bg-gray-900 rounded-full transition-colors text-slate-500 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    To ensure your <span className="text-white font-bold">Pipeline additions and status updates</span> save forever to your Google Sheet, follow these steps:
                                </p>
                                <ol className="list-decimal list-inside space-y-3 text-[11px] text-slate-300">
                                    <li>Open your Google Sheet: <span className="text-orange-500 font-mono">Bradley Insurance Blog Publisher</span></li>
                                    <li>Go to <span className="font-bold text-white">Extensions {'>'} Apps Script</span></li>
                                    <li>If you have existing code, <span className="text-blue-400 font-bold underline">copy the logic</span> below into your file. If your script is empty, just paste it all.</li>
                                    <li>Click <span className="font-bold text-white">Deploy {'>'} New Deployment</span></li>
                                    <li>Choose <span className="font-bold text-white">Web App</span>, set Access to <span className="font-bold text-white">"Anyone"</span> (this keeps it active for the Studio app).</li>
                                    <li>Copy the Web App URL and paste it into the "Google Sheets Webhook URL" field in your App Settings.</li>
                                </ol>
                            </div>

                            <div className="relative group">
                                <label className="absolute -top-2 left-4 bg-gray-950 px-2 text-[8px] font-black text-blue-500 uppercase tracking-widest z-10">Unified Sync Script</label>
                                <div className="max-h-64 overflow-y-auto bg-black p-6 rounded-2xl border border-gray-800 font-mono text-[10px] text-green-500 custom-scrollbar whitespace-pre">
                                    {APPS_SCRIPT_CODE}
                                </div>
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(APPS_SCRIPT_CODE);
                                        alert('Script copied to clipboard!');
                                    }}
                                    className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-xl transition-all"
                                >
                                    Copy Script Code
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Content Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-950 border border-gray-800 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="flex justify-between items-center p-8 border-b border-gray-900 bg-gray-900/20">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Add to Pipeline</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Staging New Blog Content</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-900 rounded-full transition-colors text-slate-500 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleAddContent} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {/* Similarity Layer - Always at the Top */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <Type className="w-3 h-3 text-orange-500" /> Proposed Topic Title
                                    </label>
                                    <div className="flex gap-2">
                                        <input 
                                            required
                                            type="text"
                                            value={newItem.Title || ''}
                                            onChange={e => {
                                                setNewItem(prev => ({ ...prev, Title: e.target.value }));
                                                setSimilarityWarning(null);
                                                setScanPerformed(false);
                                            }}
                                            placeholder="Enter compelling blog title..."
                                            className="grow bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-medium"
                                        />
                                        <button 
                                            type="button"
                                            onClick={runSimilarityScan}
                                            disabled={!newItem.Title?.trim() || isScanning}
                                            className={`px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                isScanning 
                                                ? 'bg-gray-800 text-slate-500' 
                                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                            }`}
                                        >
                                            {isScanning ? 'Scanning...' : 'Scan Duplicates'}
                                        </button>
                                    </div>
                                </div>

                                {scanPerformed && (
                                    <div className="animate-in fade-in slide-in-from-top-4">
                                        <div className={`p-4 rounded-[2rem] border-2 flex items-center justify-between mb-4 ${
                                            avgSimilarity > 40 ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'
                                        }`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-black ${
                                                    avgSimilarity > 40 ? 'bg-red-500 text-white' : 'bg-green-600 text-white'
                                                }`}>
                                                    {avgSimilarity}%
                                                </div>
                                                <div>
                                                    <p className={`text-[10px] font-black uppercase tracking-widest ${avgSimilarity > 40 ? 'text-red-500' : 'text-green-500'}`}>
                                                        {avgSimilarity > 40 ? 'Duplicate Alert' : 'Unique Content Pass'}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 font-medium">Comparison against {allHistoricalTitles.length} existing items</p>
                                                </div>
                                            </div>
                                            {avgSimilarity > 40 && (
                                                <button 
                                                    type="button"
                                                    onClick={() => setNewItem(prev => ({ ...prev, Title: '' }))}
                                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                                                >
                                                    Discard & Rename
                                                </button>
                                            )}
                                        </div>

                                        {similarityResults.length > 0 && (
                                            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
                                                <p className="px-4 py-2 bg-gray-800 text-[8px] font-black text-slate-500 uppercase tracking-widest">Similarity Breakdown</p>
                                                <div className="divide-y divide-gray-800">
                                                    {similarityResults.map((r, i) => (
                                                        <div key={i} className="px-4 py-3 flex justify-between items-center bg-black/20">
                                                            <span className="text-[11px] text-slate-300 font-medium truncate max-w-[300px]">{r.title}</span>
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${r.score > 50 ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-400'}`}>{r.score}% Match</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Section Lock - Only show full form after a scan and if user wants to proceed */}
                            <div className={`space-y-6 transition-all duration-500 ${!scanPerformed ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <Tag className="w-3 h-3 text-orange-500" /> Category
                                    </label>
                                    <select 
                                        value={newItem.Category}
                                        onChange={e => setNewItem(prev => ({ ...prev, Category: e.target.value }))}
                                        className="w-full bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-medium appearance-none cursor-pointer"
                                    >
                                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <Clock className="w-3 h-3 text-orange-500" /> Best Posting Time
                                    </label>
                                    <select 
                                        value={newItem['Best Posting Time']}
                                        onChange={e => setNewItem(prev => ({ ...prev, 'Best Posting Time': e.target.value }))}
                                        className="w-full bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-medium appearance-none cursor-pointer"
                                    >
                                        {POSTING_TIMES.map(time => <option key={time} value={time}>{time}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <Calendar className="w-3 h-3 text-orange-500" /> Initial Status
                                    </label>
                                    <select 
                                        value={newItem.Status}
                                        onChange={e => setNewItem(prev => ({ ...prev, Status: e.target.value }))}
                                        className="w-full bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-medium appearance-none cursor-pointer"
                                    >
                                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <Terminal className="w-3 h-3 text-orange-500" /> Prompt Preset
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-6 pointer-events-none">
                                            <Terminal className="w-4 h-4 text-slate-600 group-focus-within:text-orange-500 transition-colors" />
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => setNewItem(prev => ({ ...prev, Prompt: getDefaultPrompt(prev.Title || 'New Blog', prev.Category || 'General Insurance') }))}
                                            className="w-full bg-gray-900/50 border border-gray-800 hover:border-slate-700 rounded-2xl px-12 py-4 text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-all text-left"
                                        >
                                            Apply Standard Template
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                                    <Terminal className="w-3 h-3 text-orange-500" /> Generation Prompt
                                </label>
                                <textarea 
                                    value={newItem.Prompt || ''}
                                    onChange={e => setNewItem(prev => ({ ...prev, Prompt: e.target.value }))}
                                    placeholder="Enter specific instructions for the AI generator..."
                                    rows={4}
                                    className="w-full bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-medium resize-none custom-scrollbar"
                                />
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button 
                                    type="button"
                                    onClick={handleClearForm}
                                    className="px-6 py-4 rounded-3xl border border-red-500/30 text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95 flex items-center gap-2"
                                    title="Reset all fields"
                                >
                                    <X className="w-4 h-4" /> Reset Form
                                </button>
                                <button 
                                    onClick={handleAddContent}
                                    disabled={!scanPerformed || syncState === 'loading'}
                                    className={`flex-1 flex justify-center items-center gap-3 py-4 rounded-3xl shadow-xl transition-all font-black text-[12px] uppercase tracking-[0.2em] relative overflow-hidden group ${
                                        !scanPerformed ? 'bg-gray-800 text-slate-500 cursor-not-allowed' :
                                        syncState === 'loading' ? 'bg-slate-800 cursor-wait' : 'bg-orange-600 hover:bg-orange-700 text-white'
                                    }`}
                                >
                                    <Database className={`w-5 h-5 ${syncState === 'loading' ? 'animate-spin' : ''}`} />
                                    <span>{syncState === 'loading' ? 'Committing...' : !scanPerformed ? 'Scan Title First' : 'Add to Pipeline'}</span>
                                </button>
                            </div>
                        </div>
                    </form>
                    </div>
                </div>
            )}

            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-8 text-xs font-bold uppercase tracking-widest text-center">{error}</div>}
            
            <div className="flex flex-col gap-4">
                {columns.map(col => {
                    const columnItems = items.filter(i => i.Status === col.status);
                    const isOpen = openSections[col.status] !== false;

                    return (
                        <div key={col.status} className={`rounded-3xl border ${col.borderColor} overflow-hidden shadow-2xl`}>
                            <button 
                                onClick={() => toggleSection(col.status)}
                                className={`w-full flex items-center justify-between p-6 ${col.bgColor} hover:brightness-125 transition-all text-left group`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-2 rounded-full ${col.status === 'Uploaded for Publishing' ? 'bg-green-500' : col.status === 'NOT STARTED' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">
                                        {col.label}
                                        <span className="ml-4 tabular-nums opacity-50">{columnItems.length}</span>
                                    </h3>
                                </div>
                                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                            </button>

                            {isOpen && (
                                <div className="bg-gray-900/30 p-6">
                                    {columnItems.length === 0 ? (
                                        <div className="text-center py-12 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                                            No items in this stage
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {columnItems.map((item, idx) => (
                                                <div key={idx} className="bg-gray-950 border border-gray-800 p-6 rounded-2xl shadow-xl hover:border-orange-500/30 transition-all group flex flex-col justify-between">
                                                    <div className="flex flex-col flex-grow">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest bg-gray-900 px-2 py-1 rounded border border-gray-800">
                                                                {item.Category}
                                                            </span>
                                                            <span className="text-[8px] font-medium text-slate-600">{item.Timestamp ? new Date(item.Timestamp).toLocaleDateString() : ''}</span>
                                                        </div>
                                                        <h4 className="text-sm font-bold text-white mb-2 leading-tight group-hover:text-orange-500 transition-colors uppercase tracking-tight">{item.Title}</h4>
                                                        
                                                        {item['Best Posting Time'] && (
                                                            <div className="flex items-center gap-1.5 mb-4">
                                                                <Clock className="w-3 h-3 text-slate-600" />
                                                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{item['Best Posting Time']}</span>
                                                            </div>
                                                        )}

                                                        <button 
                                                            onClick={() => setExpandedItem(expandedItem === item.Title ? null : item.Title)}
                                                            className="text-[9px] font-black text-slate-500 hover:text-orange-500 uppercase tracking-widest transition-colors mb-4 flex items-center gap-1"
                                                        >
                                                            {expandedItem === item.Title ? 'Hide Details' : 'View Details'}
                                                            {expandedItem === item.Title ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                        </button>

                                                        {expandedItem === item.Title && item.Prompt && (
                                                            <div className="mb-4 p-4 bg-gray-900/50 rounded-xl border border-gray-800/50">
                                                                <p className="text-[10px] text-slate-400 font-medium leading-relaxed whitespace-pre-wrap line-clamp-[10]">
                                                                    {item.Prompt}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="mt-4 pt-4 border-t border-gray-800/50 flex justify-end">
                                                        {getStatusButtons(item)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Pipeline;
