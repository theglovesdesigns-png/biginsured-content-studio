
import React, { useState, useEffect } from 'react';
import { generateBlogPost, generateBlogSeries } from '../services/geminiService';
import { sendBlogToSheet } from '../services/sheetService';
import { updatePipelineStatus } from '../services/pipelinePersistence';
import { upsertBlogPost } from '../services/postService';
import { saveImageFeedback } from '../services/feedbackService';
import { BlogPost, BlogSeries, SeriesPost, GeneratorPrompt } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { SUPABASE_CONFIG } from '../services/config';

interface BlogBuilderProps {
    onSendImagePrompt: (prompt: string, metadata?: GeneratorPrompt['metadata']) => void;
    initialTopic?: string | null;
    onTopicConsumed?: () => void;
}

const BlogBuilder: React.FC<BlogBuilderProps> = ({ onSendImagePrompt, initialTopic, onTopicConsumed }) => {
    const [mode, setMode] = useState<'single' | 'series'>('single');
    const [titleIdea, setTitleIdea] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<string>('Auto Insurance');
    const [wordCountRange, setWordCountRange] = useState('1200-1500');
    const [postingTime, setPostingTime] = useState<string>('');
    const [pipelineTimestamp, setPipelineTimestamp] = useState<string>('');
    const [pipelineTitle, setPipelineTitle] = useState<string>('');
    
    // Series State
    const [seriesTitle, setSeriesTitle] = useState('');
    const [seriesStrategy, setSeriesStrategy] = useState('');
    const [targetVolume, setTargetVolume] = useState(4);
    const [generatedSeries, setGeneratedSeries] = useState<BlogSeries | null>(null);

    const [generatedPost, setGeneratedPost] = useState<BlogPost | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [sheetUrl, setSheetUrl] = useState('');
    const [isSheetConfigOpen, setIsSheetConfigOpen] = useState(false);
    const [isSendingToSheet, setIsSendingToSheet] = useState(false);
    const [sheetStatus, setSheetStatus] = useState<{type: 'success' | 'error', message: string} | null>(null);
    const [isNavigatingToGenerator, setIsNavigatingToGenerator] = useState(false);

    // PERSISTENCE: Load saved blog and series on mount
    useEffect(() => {
        const savedPost = localStorage.getItem('big_current_generated_blog');
        if (savedPost) {
            try {
                setGeneratedPost(JSON.parse(savedPost));
            } catch (e) {
                console.error("Failed to load persistent blog state");
            }
        }

        const savedSeries = localStorage.getItem('big_current_generated_series');
        if (savedSeries) {
            try {
                setGeneratedSeries(JSON.parse(savedSeries));
            } catch (e) {
                console.error("Failed to load persistent series state");
            }
        }

        const configUrl = SUPABASE_CONFIG.GOOGLE_SHEETS_WEBHOOK_URL;
        const savedUrl = localStorage.getItem('googleSheetsWebhookUrl');
        if (configUrl) setSheetUrl(configUrl);
        else if (savedUrl) setSheetUrl(savedUrl);
    }, []);

    // Handle initial topic and prefilled data
    useEffect(() => {
        if (initialTopic) {
            setTitleIdea(initialTopic);
            setMode('single');
            if (onTopicConsumed) onTopicConsumed();
        }

        // Try to load prefilled data from localStorage as a fallback
        const preTit = localStorage.getItem('prefilled_blog_title');
        const preCat = localStorage.getItem('prefilled_blog_category');
        const prePrm = localStorage.getItem('prefilled_blog_prompt');
        const preTime = localStorage.getItem('prefilled_blog_posting_time');
        const preTs = localStorage.getItem('prefilled_blog_timestamp');

        if (preTit) {
            setTitleIdea(preTit);
            setPipelineTitle(preTit);
            setSeriesTitle(preTit); // Also sync to series
            localStorage.removeItem('prefilled_blog_title');
        }
        if (preCat) {
            setCategory(preCat);
            localStorage.removeItem('prefilled_blog_category');
        }
        if (preTime) {
            setPostingTime(preTime);
            localStorage.removeItem('prefilled_blog_posting_time');
        }
        if (preTs) {
            setPipelineTimestamp(preTs);
            localStorage.removeItem('prefilled_blog_timestamp');
        }
        if (prePrm) {
            setDescription(prePrm);
            setSeriesStrategy(prePrm); // Also sync to series
            localStorage.removeItem('prefilled_blog_prompt');
            
            // Try to extract word count from prompt (e.g. "1,200-1,800 word")
            const wordMatch = prePrm.match(/(\d{3,4})[-,](\d{3,4})\s*word/i);
            if (wordMatch) {
                const range = `${wordMatch[1]}-${wordMatch[2]}`.replace(/,/g, '');
                // Check if this range is one of our preset options
                const validRanges = ['500-800', '800-1200', '1200-1500', '1500-2000', '2000-2500', '2500-3000'];
                if (validRanges.includes(range)) {
                    setWordCountRange(range);
                } else {
                    // Try to find the closest match or at least something similar
                    const start = parseInt(wordMatch[1].replace(/,/g, ''));
                    if (start >= 2000) setWordCountRange('2000-2500');
                    else if (start >= 1500) setWordCountRange('1500-2000');
                    else if (start >= 1200) setWordCountRange('1200-1500');
                    else if (start >= 800) setWordCountRange('800-1200');
                    else setWordCountRange('500-800');
                }
            }
        }
    }, [initialTopic, onTopicConsumed]);

    // PERSISTENCE: Save blog whenever it changes
    useEffect(() => {
        if (generatedPost) {
            localStorage.setItem('big_current_generated_blog', JSON.stringify(generatedPost));
        }
    }, [generatedPost]);

    // PERSISTENCE: Save series whenever it changes
    useEffect(() => {
        if (generatedSeries) {
            localStorage.setItem('big_current_generated_series', JSON.stringify(generatedSeries));
        }
    }, [generatedSeries]);

    const handleClearProject = () => {
        setGeneratedPost(null);
        setGeneratedSeries(null);
        localStorage.removeItem('big_current_generated_blog');
        localStorage.removeItem('big_current_generated_series');
        setTitleIdea('');
        setDescription('');
        setSeriesTitle('');
        setSeriesStrategy('');
        setCategory('Auto Insurance');
        setWordCountRange('1200-1500');
        setMode('single');
        setError(null);
    };

    const hasContent = titleIdea.trim() || description.trim() || generatedPost || generatedSeries || seriesTitle.trim() || seriesStrategy.trim();

    const saveSheetUrl = (url: string) => {
        setSheetUrl(url);
        localStorage.setItem('googleSheetsWebhookUrl', url);
        setIsSheetConfigOpen(false);
    };

    const handleGenerate = async () => {
        if (!titleIdea.trim() || !description.trim()) return;
        setIsLoading(true);
        setError(null);
        try {
            const post = await generateBlogPost(titleIdea, description, wordCountRange, category);
            setGeneratedPost({
                ...post,
                pipeline_title: pipelineTitle || undefined,
                pipeline_timestamp: pipelineTimestamp || undefined
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error generating content.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateSeries = async () => {
        if (!seriesTitle.trim() || !seriesStrategy.trim()) return;
        setIsLoading(true);
        setError(null);
        try {
            const series = await generateBlogSeries(seriesTitle, seriesStrategy, targetVolume, wordCountRange, category);
            setGeneratedSeries(series);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error architecting series.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDrillDown = (post: SeriesPost) => {
        setTitleIdea(post.title);
        setDescription(post.description);
        setWordCountRange(post.suggested_word_count);
        setCategory(post.category);
        setMode('single');
        setGeneratedPost(null);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleAddBonus = (post: SeriesPost) => {
        if (!generatedSeries) return;
        setGeneratedSeries({
            ...generatedSeries,
            posts: [...generatedSeries.posts, post],
            bonus_suggestions: generatedSeries.bonus_suggestions.filter(p => p.title !== post.title),
            total_posts: generatedSeries.total_posts + 1
        });
    };

    const handleSendToSheet = async () => {
        if (!generatedPost) return;
        if (!sheetUrl) {
            setIsSheetConfigOpen(true);
            return;
        }
        setIsSendingToSheet(true);
        setSheetStatus(null);
        
        try {
            // Stage 1: Attempt Google Sheets Sync
            let sheetSuccess = false;
            try {
                await sendBlogToSheet(sheetUrl, generatedPost);
                sheetSuccess = true;
                console.log("Stage 1: Google Sheet Synced Successfully");
            } catch (sheetErr) {
                console.error('Stage 1 Error (Google Sheet):', sheetErr);
                // We don't throw here yet, we want to try the DB save too
            }
            
            // Stage 2: Attempt Supabase/Database Sync
            let dbSuccess = false;
            try {
                // Save actual blog content
                await upsertBlogPost(generatedPost);
                
                // Sync status back to Pipeline if applicable
                const lookupTitle = (generatedPost.pipeline_title || generatedPost.title || '').trim();
                if (lookupTitle) {
                    await updatePipelineStatus(lookupTitle, 'Uploaded for Publishing');
                }
                dbSuccess = true;
                console.log("Stage 2: Database Synced Successfully");
            } catch (dbErr) {
                console.error('Stage 2 Error (Database):', dbErr);
                // If Sheet worked but DB failed, inform the user
                if (sheetSuccess) {
                    setSheetStatus({ 
                        type: 'success', 
                        message: 'Sheet Synced! (Note: DB backup failed, but your sheet is updated)' 
                    });
                    setTimeout(() => setSheetStatus(null), 8000);
                    return;
                }
                throw dbErr; // If both failed or only DB failed (and sheet wasn't successful), propagate
            }

            // Final Result Analysis
            if (sheetSuccess && dbSuccess) {
                setSheetStatus({ type: 'success', message: 'Total Success: Synced to Schedule & Database!' });
            } else if (dbSuccess) {
                setSheetStatus({ type: 'error', message: 'DB Save Success, but Sheet Sync Failed. (Check URL?)' });
            }
            
            setTimeout(() => setSheetStatus(null), 5000);
        } catch (err) {
            console.error('Final Sync Workflow Error:', err);
            setSheetStatus({ 
                type: 'error', 
                message: err instanceof Error ? `Sync Failed: ${err.message}` : 'Sync Failed. Please check logs.' 
            });
        } finally {
            setIsSendingToSheet(false);
        }
    };

    const handleDownload = () => {
        if (!generatedPost) return;
        const content = `TITLE: ${generatedPost.title}
CATEGORY: ${generatedPost.category}
SLUG: ${generatedPost.slug}
ESTIMATED WORDS: ${generatedPost.estimated_word_count}
POSTING TIME: ${postingTime || 'Not Specified'}
PIPELINE STAMP: ${pipelineTimestamp || 'Not Specified'}

--- SEO DNA ---
KEYWORDS: ${generatedPost.tags_keywords}
HERO PROMPT: ${generatedPost.hero_image_prompt}

--- CONTENT ---
${generatedPost.content}
`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${generatedPost.slug || 'blog-post'}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    
    const handleTransitionToImage = (prompt: string, imageType?: GeneratorPrompt['metadata']['imageType']) => {
        setIsNavigatingToGenerator(true);
        setTimeout(() => {
            onSendImagePrompt(prompt, generatedPost?.slug ? { slug: generatedPost.slug, imageType: imageType || 'hero' } : undefined);
            setIsNavigatingToGenerator(false);
        }, 1200);
    };

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
 * Scan sheet from bottom up to find last row with actual data (ignoring ghost styled cells)
 */
function getLastPopulatedRow(sheet) {
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    // Check if either column A, B, or C has data
    if (values[i] && (values[i][0] !== "" || (values[i][1] !== "" && values[i][1] !== undefined))) {
      return i + 1; // 1-based row index
    }
  }
  return 0;
}

/**
 * Modular logic to handle Content Studio operations
 */
function handleStudioRequest(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pipelineSheetName = "Future_Blog_Ideas_Copied";
  var scheduleSheetName = "Blog Schedule";
  
  // ACTION: Add to Pipeline
  if (params.type === "add_content") {
    var sheet = ss.getSheetByName(pipelineSheetName) || ss.insertSheet(pipelineSheetName);
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
     var sheet = ss.getSheetByName(pipelineSheetName);
     if (!sheet) return ContentService.createTextOutput("Error: Sheet not found");
     var data = sheet.getDataRange().getValues();
     for (var i = 1; i < data.length; i++) {
       if (data[i][0] === params.title) {
         sheet.getRange(i + 1, 5).setValue(params.status); // Column E is Status
         break;
       }
     }
     return ContentService.createTextOutput("Success: Updated").setMimeType(ContentService.MimeType.TEXT);
  }

  // ACTION: Port to Published Schedule
  if (params.type === "port_to_schedule") {
    var scheduleSheet = ss.getSheetByName(scheduleSheetName) || ss.insertSheet(scheduleSheetName);
    var targetS_Row = getLastPopulatedRow(scheduleSheet);
    if (targetS_Row === 0) {
      scheduleSheet.appendRow(["ID", "Title", "Excerpt", "Content", "Category", "Image URL", "Author", "Keywords", "Slug", "Meta Title", "Meta Description", "Publish Time", "Word Count", "Status"]);
      scheduleSheet.getRange(1, 1, 1, 14).setFontWeight("bold").setBackground("#f3f3f3");
      targetS_Row = 1;
    }
    scheduleSheet.getRange(targetS_Row + 1, 1, 1, 14).setValues([[
      params.id,
      params.title,
      params.excerpt,
      params.content,
      params.category,
      params.image_url || "",
      params.author || "Licensed Ohio Agent",
      params.tags_keywords,
      params.slug,
      params.meta_title,
      params.meta_description,
      params.publish_at_time,
      params.word_count || 0,
      "Draft" // Force to Draft status on initial upload
    ]]);

    // SYNC BACK: Also update the status in the pipeline if identified
    var pSheet = ss.getSheetByName(pipelineSheetName);
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

    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 relative animate-fade-in">
            {isNavigatingToGenerator && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center backdrop-blur-md">
                    <div className="flex flex-col items-center">
                        <div className="w-20 h-20 border-4 border-white border-t-orange-500 rounded-full animate-spin mb-6"></div>
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Materializing Vision...</h3>
                    </div>
                </div>
            )}

            {isSheetConfigOpen && (
                <div className="fixed inset-0 bg-black/90 z-[300] flex items-center justify-center p-4 backdrop-blur-xl" onClick={() => setIsSheetConfigOpen(false)}>
                    <div className="bg-gray-950 border border-blue-500/30 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden shadow-blue-900/10" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-8 bg-blue-600/10 border-b border-blue-500/20">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoinPath="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Sync Configuration</h3>
                                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-1">Merge with your existing webhooks</p>
                                </div>
                            </div>
                            <button onClick={() => setIsSheetConfigOpen(false)} className="p-2 hover:bg-gray-900 rounded-full transition-colors text-slate-500 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                            <div className="space-y-4">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Google Sheets Webhook URL</label>
                                <input type="text" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" className="w-full bg-gray-900 border-2 border-gray-800 focus:border-blue-500 rounded-2xl p-4 text-sm outline-none transition-all text-white font-bold" />
                                
                                <div className="p-6 bg-blue-600/5 border border-blue-500/20 rounded-3xl space-y-4 text-xs">
                                    <p className="text-slate-400 font-medium">To avoid breaking your <span className="text-white font-black italic">existing webhooks</span>, merge this logic into your Apps Script:</p>
                                    <ol className="list-decimal list-inside space-y-3 text-slate-300">
                                        <li>Open Apps Script and find your existing <code className="text-blue-400 font-bold">doPost(e)</code>.</li>
                                        <li>Paste the <span className="font-black text-white">handleStudioRequest</span> function (below) at the bottom.</li>
                                        <li>Inside your <code className="text-blue-400">doPost(e)</code>, add: <br/> 
                                            <code className="block mt-2 p-3 bg-black rounded-lg text-blue-400 border border-blue-500/30">
                                                var params = JSON.parse(e.postData.contents);<br/>
                                                if (params.appSource === "BigInsured_Studio") {'{'} return handleStudioRequest(params); {'}'}
                                            </code>
                                        </li>
                                    </ol>
                                </div>
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
                        
                        <div className="p-8 bg-black/40 border-t border-gray-800 flex justify-end">
                            <button onClick={() => saveSheetUrl(sheetUrl)} className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95">
                                Save Connection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 p-10 rounded-[2.5rem] shadow-2xl">
                <div className="flex justify-between items-end mb-12">
                    <div>
                        <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">BIG Content Architect</h2>
                        <p className="text-gray-400 font-bold text-xs mt-3 uppercase tracking-[0.3em]">SEO & Visual Strategy Engine</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-100 dark:bg-gray-900 p-1.5 rounded-2xl flex gap-1">
                            <button 
                                onClick={() => {
                                    // Sync from series if single is empty
                                    if (!titleIdea.trim() && seriesTitle.trim()) setTitleIdea(seriesTitle);
                                    if (!description.trim() && seriesStrategy.trim()) setDescription(seriesStrategy);
                                    setMode('single');
                                }} 
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'single' ? 'bg-white dark:bg-gray-800 text-orange-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Single Post
                            </button>
                            <button 
                                onClick={() => {
                                    // Sync from single if series is empty
                                    if (!seriesTitle.trim() && titleIdea.trim()) setSeriesTitle(titleIdea);
                                    if (!seriesStrategy.trim() && description.trim()) setSeriesStrategy(description);
                                    setMode('series');
                                }} 
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'series' ? 'bg-white dark:bg-gray-800 text-orange-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Series Architect
                            </button>
                        </div>
                        {hasContent && (
                            <button onClick={handleClearProject} className="text-[10px] font-black uppercase bg-red-50 dark:bg-red-950/20 px-4 py-2 rounded-full text-red-600 hover:bg-red-600 hover:text-white transition-all border border-red-200 dark:border-red-900/50">Start New</button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mb-8 bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-900/50 p-6 rounded-3xl flex items-center gap-4 animate-shake">
                        <div className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center font-black">!</div>
                        <div className="flex-1">
                            <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Architectural Error</h4>
                            <p className="text-sm font-bold text-red-900 dark:text-red-200">{error}</p>
                        </div>
                        <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 font-black text-xl">×</button>
                    </div>
                )}
                
                {mode === 'single' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        <div className="space-y-8">
                            {generatedSeries && (
                                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 p-4 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Active Series: {generatedSeries.series_title}</span>
                                    </div>
                                    <button onClick={() => setMode('series')} className="text-[8px] font-black uppercase bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-900/50 text-orange-600 hover:bg-orange-600 hover:text-white transition-all">View Map</button>
                                </div>
                            )}
                            <div>
                                <label className="block text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-2 ml-1">Article Objective</label>
                                <input id="blog-objective-input" type="text" value={titleIdea} onChange={(e) => setTitleIdea(e.target.value)} placeholder="e.g. Home Insurance Rising Costs in Ohio" className="w-full bg-slate-50 dark:bg-gray-900 border-2 border-transparent focus:border-orange-500 rounded-2xl p-5 text-lg outline-none transition-all dark:text-white font-black" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-2 ml-1">Strategy Briefing</label>
                                <textarea id="blog-strategy-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Relatable scenarios, Ohio local context, pain points..." className="w-full h-48 bg-slate-50 dark:bg-gray-900 border-2 border-transparent focus:border-orange-500 rounded-2xl p-5 text-sm outline-none transition-all dark:text-white resize-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-2 ml-1">Target Category</label>
                                <input type="hidden" id="blog-category-input" value={category} />
                                <div className="flex flex-wrap gap-2">
                                    {['Claims', 'Auto Insurance', 'Home Insurance', 'Business Insurance', 'General Insurance'].map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setCategory(cat)}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${category === cat ? 'bg-orange-600 border-white text-white' : 'bg-slate-50 dark:bg-gray-900 text-gray-400 border-transparent hover:border-orange-500/30'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-8">
                             <div className="bg-slate-50 dark:bg-gray-900 p-8 rounded-[2rem] border border-slate-100 dark:border-gray-800">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-6 text-center">Length Specs</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {['500-800', '800-1200', '1200-1500', '1500-2000', '2000-2500', '2500-3000'].map(range => (
                                        <button key={range} onClick={() => setWordCountRange(range)} className={`py-3 px-4 rounded-2xl text-[10px] font-black uppercase transition-all border-2 flex items-center justify-between ${wordCountRange === range ? 'bg-orange-600 border-white text-white shadow-lg' : 'bg-white dark:bg-gray-950 text-gray-400 border-slate-200 dark:border-gray-800'}`}>
                                            <span>{range} words</span>
                                            {wordCountRange === range && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleGenerate} disabled={isLoading} className="w-full bg-orange-600 text-white font-black py-6 rounded-[1.5rem] shadow-2xl transition-all transform active:scale-95 uppercase tracking-tighter text-xl border-2 border-transparent hover:border-white">
                                {isLoading ? 'Architecting...' : 'Build Complete Post Strategy'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-fade-in">
                        <div className="space-y-8">
                            <div>
                                <label className="block text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-2 ml-1">Series Master Title</label>
                                <input type="text" value={seriesTitle} onChange={(e) => setSeriesTitle(e.target.value)} placeholder="e.g. The Ohio First-Time Homeowner's Guide" className="w-full bg-slate-50 dark:bg-gray-900 border-2 border-transparent focus:border-orange-500 rounded-2xl p-5 text-lg outline-none transition-all dark:text-white font-black" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-2 ml-1">Series Strategy</label>
                                <textarea value={seriesStrategy} onChange={(e) => setSeriesStrategy(e.target.value)} placeholder="Educating new buyers on every stage of the process from closing to maintenance..." className="w-full h-48 bg-slate-50 dark:bg-gray-900 border-2 border-transparent focus:border-orange-500 rounded-2xl p-5 text-sm outline-none transition-all dark:text-white resize-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-2 ml-1">Series Category</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Claims', 'Auto Insurance', 'Home Insurance', 'Business Insurance', 'General Insurance'].map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setCategory(cat)}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${category === cat ? 'bg-orange-600 border-white text-white' : 'bg-slate-50 dark:bg-gray-900 text-gray-400 border-transparent hover:border-orange-500/30'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-8">
                            <div className="bg-slate-50 dark:bg-gray-900 p-8 rounded-[2rem] border border-slate-100 dark:border-gray-800">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-6 text-center">Target Volume</label>
                                <div className="flex items-center justify-center gap-6">
                                    <button onClick={() => setTargetVolume(Math.max(2, targetVolume - 1))} className="w-12 h-12 rounded-full bg-white dark:bg-gray-950 border-2 border-slate-200 dark:border-gray-800 flex items-center justify-center text-xl font-black text-gray-600 dark:text-gray-400 hover:border-orange-500 transition-all">-</button>
                                    <span className="text-4xl font-black text-slate-900 dark:text-white w-12 text-center">{targetVolume}</span>
                                    <button onClick={() => setTargetVolume(Math.min(10, targetVolume + 1))} className="w-12 h-12 rounded-full bg-white dark:bg-gray-950 border-2 border-slate-200 dark:border-gray-800 flex items-center justify-center text-xl font-black text-gray-600 dark:text-gray-400 hover:border-orange-500 transition-all">+</button>
                                </div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase text-center mt-4 tracking-widest">Suggested Posts</p>
                            </div>

                            <div className="bg-slate-50 dark:bg-gray-900 p-8 rounded-[2rem] border border-slate-100 dark:border-gray-800">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-6 text-center">Length Specs (Per Post)</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {['500-800', '800-1200', '1200-1500', '1500-2000', '2000-2500', '2500-3000'].map(range => (
                                        <button key={range} onClick={() => setWordCountRange(range)} className={`py-3 px-4 rounded-2xl text-[10px] font-black uppercase transition-all border-2 flex items-center justify-between ${wordCountRange === range ? 'bg-orange-600 border-white text-white shadow-lg' : 'bg-white dark:bg-gray-950 text-gray-400 border-slate-200 dark:border-gray-800'}`}>
                                            <span>{range} words</span>
                                            {wordCountRange === range && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button onClick={handleGenerateSeries} disabled={isLoading} className="w-full bg-orange-600 text-white font-black py-6 rounded-[1.5rem] shadow-2xl transition-all transform active:scale-95 uppercase tracking-tighter text-xl border-2 border-transparent hover:border-white">
                                {isLoading ? 'Architecting Series...' : 'Architect Series Map'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {generatedSeries && mode === 'series' && !isLoading && (
                <div className="space-y-10 animate-fade-in-up pb-20">
                    <div className="bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 p-10 rounded-[3rem] shadow-2xl">
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <h3 className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em] mb-2">Series Blueprint</h3>
                                <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{generatedSeries.series_title}</h2>
                            </div>
                            <div className="bg-slate-100 dark:bg-gray-900 px-6 py-3 rounded-2xl">
                                <span className="text-2xl font-black text-slate-900 dark:text-white">{generatedSeries.total_posts}</span>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Total Posts</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {generatedSeries.posts.map((post, idx) => (
                                <div key={idx} className="bg-slate-50 dark:bg-gray-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-gray-800 flex flex-col justify-between group hover:border-orange-500/50 transition-all">
                                    <div>
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center text-xs font-black">0{idx + 1}</span>
                                            <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-tight">{post.title}</h4>
                                        </div>
                                        <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">{post.description}</p>
                                    </div>
                                    <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-gray-800">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{post.suggested_word_count} words</span>
                                        <button onClick={() => handleDrillDown(post)} className="px-6 py-3 bg-white dark:bg-gray-800 border-2 border-slate-200 dark:border-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 hover:text-white hover:border-orange-600 transition-all">Generate Full Strategy</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {generatedSeries.bonus_suggestions.length > 0 && (
                            <div className="mt-12 pt-12 border-t border-slate-200 dark:border-gray-800">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="px-3 py-1 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest rounded-full">AI Expansion</div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Bonus High-Value Topics Found</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {generatedSeries.bonus_suggestions.map((post, idx) => (
                                        <div key={idx} className="bg-indigo-50/50 dark:bg-indigo-950/20 p-6 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/50 flex flex-col justify-between">
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">{post.title}</h4>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-4">{post.description}</p>
                                            </div>
                                            <button onClick={() => handleAddBonus(post)} className="w-full py-3 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all">+ Add to Series</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {generatedPost && !isLoading && (
                <div className="space-y-10 animate-fade-in-up pb-20">
                    <div className="bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-8 sticky top-24 z-30">
                        <div className="flex items-center gap-10">
                            {generatedSeries && (
                                <button onClick={() => setMode('series')} className="flex flex-col items-start group">
                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1 group-hover:text-orange-600 transition-colors">← Back to Series</span>
                                    <span className="text-xs font-black dark:text-white uppercase tracking-tighter max-w-[150px] truncate">{generatedSeries.series_title}</span>
                                </button>
                            )}
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em] mb-1">Category</span>
                                <span className="text-lg font-black dark:text-white uppercase tracking-tighter">{generatedPost.category}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">Count</span>
                                <span className="text-lg font-black dark:text-white uppercase tracking-tighter">{generatedPost.estimated_word_count} wds</span>
                            </div>
                            {postingTime && (
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-1">Schedule</span>
                                    <span className="text-lg font-black dark:text-white uppercase tracking-tighter">{postingTime}</span>
                                </div>
                            )}
                            <div className="hidden md:flex flex-col">
                                <span className="text-[10px] font-black text-green-600 uppercase tracking-[0.3em] mb-1">Integrity</span>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-[10px] font-black dark:text-white uppercase tracking-tighter">Fact-Checked & Neutral</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {sheetStatus && <span className={`text-[10px] font-black uppercase tracking-widest ${sheetStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{sheetStatus.message}</span>}
                            <button onClick={handleDownload} className="px-8 py-4 bg-white dark:bg-gray-800 text-slate-900 dark:text-white text-xs font-black rounded-2xl transition-all shadow-xl uppercase tracking-widest border-2 border-slate-200 dark:border-gray-700 hover:border-orange-500">
                                Download Text (.txt)
                            </button>
                            <button onClick={handleSendToSheet} disabled={isSendingToSheet} className="px-8 py-4 bg-orange-600 text-white text-xs font-black rounded-2xl transition-all shadow-xl uppercase tracking-widest border-2 border-white">
                                {isSendingToSheet ? 'Syncing...' : 'Transmit to Schedule'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        <div className="lg:col-span-2 bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-[3rem] p-12 shadow-2xl">
                            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-8 leading-tight tracking-tighter uppercase">{generatedPost.title}</h1>
                            <div className="prose dark:prose-invert max-w-none font-medium leading-relaxed dark:text-gray-300 whitespace-pre-wrap">{generatedPost.content}</div>
                        </div>

                        <div className="space-y-8">
                            <div className="bg-black p-8 rounded-[2.5rem] border border-orange-500/30">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Hero Visual Strategy</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => saveImageFeedback({ prompt: generatedPost.hero_image_prompt, negative_prompt: '', aspect_ratio: '16:9', feedback: 'up' })} className="text-gray-500 hover:text-green-500 transition-colors">👍</button>
                                        <button onClick={() => saveImageFeedback({ prompt: generatedPost.hero_image_prompt, negative_prompt: '', aspect_ratio: '16:9', feedback: 'down' })} className="text-gray-500 hover:text-red-500 transition-colors">👎</button>
                                    </div>
                                </div>
                                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-4">Target: [slug].jpg</span>
                                <p className="text-sm text-gray-400 font-bold mb-4 italic leading-relaxed">"{generatedPost.hero_image_prompt}"</p>
                                <div className="mb-6 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                                    <p className="text-[9px] font-black text-orange-400 uppercase tracking-wider leading-tight">
                                        Pro Tip: Use the Visual Engines in the next screen to refine lighting, composition, and style for the perfect shot.
                                    </p>
                                </div>
                                <button onClick={() => handleTransitionToImage(generatedPost.hero_image_prompt, 'hero')} className="w-full py-4 bg-orange-600 text-white font-black rounded-xl uppercase text-[9px] tracking-widest border-2 border-white">Materialize Hero</button>
                            </div>

                            {/* YouTube Thumbnail Strategy */}
                            <div className="bg-indigo-950 p-8 rounded-[2.5rem] border border-indigo-500/30">
                                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">YouTube Thumbnail Strategy</h3>
                                <div className="space-y-4">
                                    <div>
                                        <span className="text-[8px] font-black text-indigo-300/50 uppercase tracking-widest block mb-1">Base Layout Prompt</span>
                                        <p className="text-[11px] text-indigo-100 font-medium italic leading-relaxed">"{generatedPost.youtube_thumbnail_prompt}"</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-[8px] font-black text-indigo-300/50 uppercase tracking-widest block mb-1">Overlay Text</span>
                                            <p className="text-xs font-black text-white uppercase tracking-tighter">{generatedPost.youtube_thumbnail_text}</p>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-black text-indigo-300/50 uppercase tracking-widest block mb-1">Text Color</span>
                                            <p className="text-xs font-black text-white uppercase tracking-tighter">{generatedPost.youtube_thumbnail_color}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[8px] font-black text-indigo-300/50 uppercase tracking-widest block mb-1">CTR Optimization</span>
                                        <p className="text-[10px] text-indigo-200 font-medium leading-relaxed">{generatedPost.youtube_thumbnail_suggestions}</p>
                                    </div>
                                    <button onClick={() => handleTransitionToImage(generatedPost.youtube_thumbnail_prompt, 'thumbnail')} className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl uppercase text-[9px] tracking-widest border-2 border-indigo-400">Materialize Thumbnail Base</button>
                                </div>
                            </div>

                            <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inline Visual 1</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => saveImageFeedback({ prompt: generatedPost.inline_image_1_prompt, negative_prompt: '', aspect_ratio: '1:1', feedback: 'up' })} className="text-gray-500 hover:text-green-500 transition-colors">👍</button>
                                        <button onClick={() => saveImageFeedback({ prompt: generatedPost.inline_image_1_prompt, negative_prompt: '', aspect_ratio: '1:1', feedback: 'down' })} className="text-gray-500 hover:text-red-500 transition-colors">👎</button>
                                    </div>
                                </div>
                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest block mb-4">Target: [slug]_1.jpg</span>
                                <p className="text-sm text-gray-500 font-medium mb-6 italic leading-relaxed">"{generatedPost.inline_image_1_prompt}"</p>
                                <button onClick={() => handleTransitionToImage(generatedPost.inline_image_1_prompt, 'inline_1')} className="w-full py-4 bg-slate-800 text-white font-black rounded-xl uppercase text-[9px] tracking-widest">Materialize Inline 1</button>
                            </div>

                            <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inline Visual 2</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => saveImageFeedback({ prompt: generatedPost.inline_image_2_prompt, negative_prompt: '', aspect_ratio: '1:1', feedback: 'up' })} className="text-gray-500 hover:text-green-500 transition-colors">👍</button>
                                        <button onClick={() => saveImageFeedback({ prompt: generatedPost.inline_image_2_prompt, negative_prompt: '', aspect_ratio: '1:1', feedback: 'down' })} className="text-gray-500 hover:text-red-500 transition-colors">👎</button>
                                    </div>
                                </div>
                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest block mb-4">Target: [slug]_2.jpg</span>
                                <p className="text-sm text-gray-500 font-medium mb-6 italic leading-relaxed">"{generatedPost.inline_image_2_prompt}"</p>
                                <button onClick={() => handleTransitionToImage(generatedPost.inline_image_2_prompt, 'inline_2')} className="w-full py-4 bg-slate-800 text-white font-black rounded-xl uppercase text-[9px] tracking-widest">Materialize Inline 2</button>
                            </div>

                            <div className="bg-white dark:bg-gray-950 p-8 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-gray-800 space-y-6">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">SEO DNA</h3>
                                <div><label className="text-[8px] font-black text-orange-600 uppercase tracking-widest">Slug</label><p className="text-xs font-bold dark:text-white mt-1">{generatedPost.slug}</p></div>
                                <div><label className="text-[8px] font-black text-orange-600 uppercase tracking-widest">Meta Description</label><p className="text-[10px] font-medium text-gray-400 mt-1 leading-relaxed">{generatedPost.meta_description}</p></div>
                                <div><label className="text-[8px] font-black text-orange-600 uppercase tracking-widest">Keywords</label><p className="text-[10px] font-medium text-gray-500 italic mt-1 leading-relaxed">{generatedPost.tags_keywords}</p></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BlogBuilder;
