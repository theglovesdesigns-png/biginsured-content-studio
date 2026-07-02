
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {isNavigatingToGenerator && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 56, height: 56, border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid var(--red)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Materializing Vision...</span>
                    </div>
                </div>
            )}

            {isSheetConfigOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(8px)' }} onClick={() => setIsSheetConfigOpen(false)}>
                    <div className="card" style={{ width: '100%', maxWidth: 640, borderRadius: 16, overflow: 'hidden', background: 'var(--bg-panel)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--blue-dim)' }}>
                            <div>
                                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', textTransform: 'uppercase' }}>Sync Configuration</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Merge with your existing webhooks</div>
                            </div>
                            <button onClick={() => setIsSheetConfigOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
                        </div>
                        <div style={{ padding: 24, overflowY: 'auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Google Sheets Webhook URL</label>
                                <input type="text" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#22c55e', maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre', lineHeight: 1.6 }}>{APPS_SCRIPT_CODE}</div>
                            </div>
                            <button onClick={() => { navigator.clipboard.writeText(APPS_SCRIPT_CODE); alert('Script copied!'); }} className="btn btn-blue" style={{ width: '100%', justifyContent: 'center' }}>Copy Script Code</button>
                        </div>
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => saveSheetUrl(sheetUrl)} className="btn btn-blue">Save Connection</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Header card ── */}
            <div className="card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>BIG Content Architect</h2>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '4px 0 0' }}>SEO & Visual Strategy Engine</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Mode toggle */}
                        <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 3, gap: 2 }}>
                            <button
                                onClick={() => { if (!titleIdea.trim() && seriesTitle.trim()) setTitleIdea(seriesTitle); if (!description.trim() && seriesStrategy.trim()) setDescription(seriesStrategy); setMode('single'); }}
                                style={{ padding: '6px 16px', borderRadius: 6, fontSize: 10, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: mode === 'single' ? 'var(--red)' : 'transparent', color: mode === 'single' ? '#fff' : 'var(--text-muted)', border: mode === 'single' ? 'var(--btn-outline)' : '3px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }}
                            >Single Post</button>
                            <button
                                onClick={() => { if (!seriesTitle.trim() && titleIdea.trim()) setSeriesTitle(titleIdea); if (!seriesStrategy.trim() && description.trim()) setSeriesStrategy(description); setMode('series'); }}
                                style={{ padding: '6px 16px', borderRadius: 6, fontSize: 10, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: mode === 'series' ? 'var(--red)' : 'transparent', color: mode === 'series' ? '#fff' : 'var(--text-muted)', border: mode === 'series' ? 'var(--btn-outline)' : '3px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }}
                            >Series Architect</button>
                        </div>
                        {hasContent && (
                            <button onClick={handleClearProject} className="btn btn-outline-red">Start New</button>
                        )}
                    </div>
                </div>
            </div>

            {error && (
                <div style={{ background: 'rgba(220,32,32,0.08)', border: '1px solid rgba(220,32,32,0.3)', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 28, height: 28, background: 'var(--red)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, flexShrink: 0 }}>!</div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', flex: 1, margin: 0 }}>{error}</p>
                    <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>×</button>
                </div>
            )}

            {/* ── Single Post mode ── */}
            {mode === 'single' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
                    {/* Left: inputs */}
                    <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {generatedSeries && (
                            <div style={{ background: 'rgba(220,32,32,0.08)', border: '1px solid rgba(220,32,32,0.2)', borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="dot-red" style={{ animation: 'pulse-red 2s infinite' }} />
                                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Active Series: {generatedSeries.series_title}</span>
                                </div>
                                <button onClick={() => setMode('series')} className="btn btn-outline-red" style={{ padding: '4px 12px', fontSize: 9 }}>View Map</button>
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>Article Objective</label>
                            <input id="blog-objective-input" type="text" value={titleIdea} onChange={(e) => setTitleIdea(e.target.value)} placeholder="e.g. Home Insurance Rising Costs in Ohio" style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }} onFocus={e => e.target.style.borderColor = 'var(--red)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>Strategy Briefing</label>
                            <textarea id="blog-strategy-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Relatable scenarios, Ohio local context, pain points..." style={{ width: '100%', height: 140, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', transition: 'border-color 0.15s', fontFamily: 'DM Sans, sans-serif' }} onFocus={e => e.target.style.borderColor = 'var(--red)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>Target Category</label>
                            <input type="hidden" id="blog-category-input" value={category} />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {['Claims', 'Auto Insurance', 'Home Insurance', 'Business Insurance', 'General Insurance'].map(cat => (
                                    <button key={cat} onClick={() => setCategory(cat)} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 10, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: category === cat ? 'var(--red)' : 'var(--bg-elevated)', color: category === cat ? '#fff' : 'var(--text-muted)', border: category === cat ? 'var(--btn-outline)' : '3px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s' }}>
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: word count + generate */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="card" style={{ padding: 20 }}>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center' }}>Length Specs</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                {['500-800', '800-1200', '1200-1500', '1500-2000', '2000-2500', '2500-3000'].map(range => (
                                    <button key={range} onClick={() => setWordCountRange(range)} style={{ padding: '8px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', background: wordCountRange === range ? 'var(--red)' : 'var(--bg-elevated)', color: wordCountRange === range ? '#fff' : 'var(--text-muted)', border: wordCountRange === range ? 'var(--btn-outline)' : '3px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>{range} wds</span>
                                        {wordCountRange === range && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button onClick={handleGenerate} disabled={isLoading} className="btn btn-red" style={{ width: '100%', justifyContent: 'center', padding: '16px 24px', fontSize: 13, borderRadius: 10, opacity: isLoading ? 0.7 : 1 }}>
                            {isLoading ? 'Architecting...' : 'Build Complete Post Strategy'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Series mode ── */}
            {mode === 'series' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
                    <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>Series Master Title</label>
                            <input type="text" value={seriesTitle} onChange={(e) => setSeriesTitle(e.target.value)} placeholder="e.g. The Ohio First-Time Homeowner's Guide" style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }} onFocus={e => e.target.style.borderColor = 'var(--red)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>Series Strategy</label>
                            <textarea value={seriesStrategy} onChange={(e) => setSeriesStrategy(e.target.value)} placeholder="Educating new buyers on every stage of the process..." style={{ width: '100%', height: 140, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }} onFocus={e => e.target.style.borderColor = 'var(--red)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>Series Category</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {['Claims', 'Auto Insurance', 'Home Insurance', 'Business Insurance', 'General Insurance'].map(cat => (
                                    <button key={cat} onClick={() => setCategory(cat)} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 10, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', background: category === cat ? 'var(--red)' : 'var(--bg-elevated)', color: category === cat ? '#fff' : 'var(--text-muted)', border: category === cat ? 'var(--btn-outline)' : '3px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s' }}>
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="card" style={{ padding: 20 }}>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center' }}>Target Volume</label>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                                <button onClick={() => setTargetVolume(Math.max(2, targetVolume - 1))} className="btn btn-ghost" style={{ width: 40, height: 40, padding: 0, justifyContent: 'center', borderRadius: '50%', fontSize: 18 }}>−</button>
                                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', minWidth: 40, textAlign: 'center' }}>{targetVolume}</span>
                                <button onClick={() => setTargetVolume(Math.min(10, targetVolume + 1))} className="btn btn-ghost" style={{ width: 40, height: 40, padding: 0, justifyContent: 'center', borderRadius: '50%', fontSize: 18 }}>+</button>
                            </div>
                            <p style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 8 }}>Suggested Posts</p>
                        </div>
                        <div className="card" style={{ padding: 20 }}>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center' }}>Length (Per Post)</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                {['500-800', '800-1200', '1200-1500', '1500-2000', '2000-2500', '2500-3000'].map(range => (
                                    <button key={range} onClick={() => setWordCountRange(range)} style={{ padding: '8px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', background: wordCountRange === range ? 'var(--red)' : 'var(--bg-elevated)', color: wordCountRange === range ? '#fff' : 'var(--text-muted)', border: wordCountRange === range ? 'var(--btn-outline)' : '3px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s' }}>
                                        {range} wds
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button onClick={handleGenerateSeries} disabled={isLoading} className="btn btn-red" style={{ width: '100%', justifyContent: 'center', padding: '16px 24px', fontSize: 13, borderRadius: 10, opacity: isLoading ? 0.7 : 1 }}>
                            {isLoading ? 'Architecting Series...' : 'Architect Series Map'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Series results ── */}
            {generatedSeries && mode === 'series' && !isLoading && (
                <div className="card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 4 }}>Series Blueprint</div>
                            <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>{generatedSeries.series_title}</h2>
                        </div>
                        <div style={{ background: 'var(--bg-elevated)', padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{generatedSeries.total_posts}</span>
                            <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginLeft: 8 }}>Total Posts</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                        {generatedSeries.posts.map((post, idx) => (
                            <div key={idx} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, flexShrink: 0 }}>{String(idx + 1).padStart(2, '0')}</span>
                                        <h4 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>{post.title}</h4>
                                    </div>
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{post.description}</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>{post.suggested_word_count} words</span>
                                    <button onClick={() => handleDrillDown(post)} className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 9 }}>Generate Full Strategy</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {generatedSeries.bonus_suggestions.length > 0 && (
                        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                <span style={{ padding: '3px 10px', background: 'var(--blue)', color: '#fff', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', borderRadius: 4, border: 'var(--btn-outline)' }}>AI Expansion</span>
                                <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', textTransform: 'uppercase', margin: 0 }}>Bonus High-Value Topics</h3>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                                {generatedSeries.bonus_suggestions.map((post, idx) => (
                                    <div key={idx} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10, borderColor: 'rgba(29,78,216,0.2)', background: 'rgba(29,78,216,0.04)' }}>
                                        <div>
                                            <h4 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', textTransform: 'uppercase', margin: '0 0 6px' }}>{post.title}</h4>
                                            <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{post.description}</p>
                                        </div>
                                        <button onClick={() => handleAddBonus(post)} className="btn btn-blue" style={{ width: '100%', justifyContent: 'center', padding: '7px 12px', fontSize: 9 }}>+ Add to Series</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Generated post results ── */}
            {generatedPost && !isLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 80 }}>
                    {/* Sticky action bar */}
                    <div className="card" style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'sticky', top: 52, zIndex: 20, background: 'var(--bg-panel)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                            {generatedSeries && (
                                <button onClick={() => setMode('series')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>← Series</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{generatedSeries.series_title}</span>
                                </button>
                            )}
                            <div>
                                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Category</div>
                                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', textTransform: 'uppercase' }}>{generatedPost.category}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Words</div>
                                <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{generatedPost.estimated_word_count}</div>
                            </div>
                            {postingTime && (
                                <div>
                                    <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Schedule</div>
                                    <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{postingTime}</div>
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className="dot-green" />
                                <span style={{ fontSize: 9, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Fact-Checked & Neutral</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {sheetStatus && <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: sheetStatus.type === 'success' ? '#22c55e' : 'var(--red)' }}>{sheetStatus.message}</span>}
                            <button onClick={handleDownload} className="btn btn-ghost">Download .txt</button>
                            <button onClick={handleSendToSheet} disabled={isSendingToSheet} className="btn btn-red">
                                {isSendingToSheet ? 'Syncing...' : 'Transmit to Schedule'}
                            </button>
                        </div>
                    </div>

                    {/* Content + sidebar */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
                        {/* Article content */}
                        <div className="card" style={{ padding: 32 }}>
                            <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 20, lineHeight: 1.2 }}>{generatedPost.title}</h1>
                            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{generatedPost.content}</div>
                        </div>

                        {/* Right sidebar: images + SEO */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {/* Hero Visual */}
                            <div className="card" style={{ padding: 18, borderColor: 'rgba(220,32,32,0.3)', background: 'rgba(220,32,32,0.04)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Hero Visual Strategy</span>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => saveImageFeedback({ prompt: generatedPost.hero_image_prompt, negative_prompt: '', aspect_ratio: '16:9', feedback: 'up' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>👍</button>
                                        <button onClick={() => saveImageFeedback({ prompt: generatedPost.hero_image_prompt, negative_prompt: '', aspect_ratio: '16:9', feedback: 'down' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>👎</button>
                                    </div>
                                </div>
                                <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Target: [slug].jpg</span>
                                <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 12 }}>"{generatedPost.hero_image_prompt}"</p>
                                <div style={{ background: 'rgba(220,32,32,0.06)', border: '1px solid rgba(220,32,32,0.15)', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
                                    <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--red)', lineHeight: 1.5, margin: 0 }}>Pro Tip: Use Visual Engines to refine lighting, composition, and style.</p>
                                </div>
                                <button onClick={() => handleTransitionToImage(generatedPost.hero_image_prompt, 'hero')} className="btn btn-red" style={{ width: '100%', justifyContent: 'center', padding: '9px 14px', fontSize: 10 }}>Materialize Hero</button>
                            </div>

                            {/* YouTube Thumbnail */}
                            <div className="card" style={{ padding: 18, borderColor: 'rgba(29,78,216,0.3)', background: 'rgba(29,78,216,0.04)' }}>
                                <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 12 }}>YouTube Thumbnail Strategy</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div>
                                        <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>Base Layout Prompt</span>
                                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5, margin: 0 }}>"{generatedPost.youtube_thumbnail_prompt}"</p>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        <div>
                                            <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 2 }}>Overlay Text</span>
                                            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', margin: 0 }}>{generatedPost.youtube_thumbnail_text}</p>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 2 }}>Text Color</span>
                                            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', margin: 0 }}>{generatedPost.youtube_thumbnail_color}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>CTR Tips</span>
                                        <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{generatedPost.youtube_thumbnail_suggestions}</p>
                                    </div>
                                    <button onClick={() => handleTransitionToImage(generatedPost.youtube_thumbnail_prompt, 'thumbnail')} className="btn btn-blue" style={{ width: '100%', justifyContent: 'center', padding: '9px 14px', fontSize: 10 }}>Materialize Thumbnail</button>
                                </div>
                            </div>

                            {/* Inline images */}
                            {[
                                { label: 'Inline Visual 1', prompt: generatedPost.inline_image_1_prompt, type: 'inline_1' as const, slug_suffix: '_1' },
                                { label: 'Inline Visual 2', prompt: generatedPost.inline_image_2_prompt, type: 'inline_2' as const, slug_suffix: '_2' },
                            ].map(img => (
                                <div key={img.type} className="card" style={{ padding: 18 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{img.label}</span>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button onClick={() => saveImageFeedback({ prompt: img.prompt, negative_prompt: '', aspect_ratio: '1:1', feedback: 'up' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>👍</button>
                                            <button onClick={() => saveImageFeedback({ prompt: img.prompt, negative_prompt: '', aspect_ratio: '1:1', feedback: 'down' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>👎</button>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Target: [slug]{img.slug_suffix}.jpg</span>
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 12 }}>"{img.prompt}"</p>
                                    <button onClick={() => handleTransitionToImage(img.prompt, img.type)} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '8px 14px', fontSize: 10 }}>Materialize {img.label}</button>
                                </div>
                            ))}

                            {/* SEO DNA */}
                            <div className="card" style={{ padding: 18 }}>
                                <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 14 }}>SEO DNA</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div>
                                        <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 3 }}>Slug</span>
                                        <p style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-primary)', margin: 0 }}>{generatedPost.slug}</p>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 3 }}>Meta Description</span>
                                        <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{generatedPost.meta_description}</p>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 3 }}>Keywords</span>
                                        <p style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5, margin: 0 }}>{generatedPost.tags_keywords}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BlogBuilder;
