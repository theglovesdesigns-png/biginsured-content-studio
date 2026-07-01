
import React, { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { getSupabaseClient } from '../services/supabaseClient';
import { ManagedFile } from '../types';
import FilePreview from './FilePreview';
import { SUPABASE_CONFIG } from '../services/config';
import { applyPrecisionCrop } from '../services/imageUtils';

/**
 * Utility to convert data URL to Blob without using fetch()
 * fetch(dataUrl) can fail with 'Failed to fetch' for large strings.
 */
function dataURLtoBlob(dataurl: string) {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error("Invalid data URL");
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}

interface UploaderProps {
    files: ManagedFile[];
    onFilesAdded: (files: File[]) => void;
    onFileRemoved: (id: string) => void;
    onUploadComplete: () => void;
    onUpdateFile: (id: string, updates: Partial<ManagedFile>) => void;
}

interface PresetOption {
    id: string;
    label: string;
    width: number; 
    height: number;
    suffix: string;
    description: string;
}

interface PresetGroup {
    name: string;
    options: PresetOption[];
}

const PRESET_GROUPS: PresetGroup[] = [
    {
        name: 'Website Architecture',
        options: [
            { id: 'blog-hero', label: 'Blog Hero', width: 1600, height: 900, suffix: 'blog-hero', description: 'Hero Banner (16:9)' },
            { id: 'service-section', label: 'Service Block', width: 1600, height: 533, suffix: 'service', description: 'Section Banner (3:1)' },
            { id: 'flexible', label: 'Flexible Full', width: 1920, height: 1080, suffix: 'full-width', description: 'Standard 16:9' },
        ]
    },
    {
        name: 'Social Media (Essential)',
        options: [
            { id: 'insta-square', label: 'Insta Square', width: 1080, height: 1080, suffix: 'insta-sq', description: '1:1 Feed Post' },
            { id: 'stories', label: 'Stories / Reels', width: 1080, height: 1920, suffix: 'story', description: '9:16 Vertical' },
            { id: 'fb-post', label: 'Facebook Post', width: 1200, height: 630, suffix: 'fb', description: 'Shared Link' },
            { id: 'x-post', label: 'X (Twitter)', width: 1200, height: 675, suffix: 'x-post', description: 'Standard Feed' },
        ]
    },
    {
        name: 'Local Business & Branding',
        options: [
            { id: 'gmb-post', label: 'GMB Post', width: 1200, height: 900, suffix: 'gmb', description: 'Google Business' },
            { id: 'youtube', label: 'YouTube Thumb', width: 1280, height: 720, suffix: 'yt-thumb', description: 'Thumbnail' },
            { id: 'x-header', label: 'X Header', width: 1500, height: 500, suffix: 'x-header', description: 'Header Banner' },
        ]
    }
];

const ORIGINAL_PRESET: PresetOption = { id: 'original', label: 'Original Scale', width: 0, height: 0, suffix: 'original', description: 'Untouched resolution' };

const Uploader: React.FC<UploaderProps> = ({ files, onFilesAdded, onFileRemoved, onUploadComplete, onUpdateFile }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]); 
    const [uploadBucket, setUploadBucket] = useState(SUPABASE_CONFIG.IMAGES_BUCKET);
    const [folderName, setFolderName] = useState(() => {
        // Pre-fill from the first file in the queue that has a folder
        return files.find(f => f.folder)?.folder || '';
    });
    const [downloadEnabled, setDownloadEnabled] = useState(false);
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    
    const onDrop = useCallback((acceptedFiles: File[]) => {
        onFilesAdded(acceptedFiles);
    }, [onFilesAdded]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.jpeg', '.png', '.gif', '.webp'] },
        noClick: files.length > 0,
        noKeyboard: true,
    } as any);
    
    const handlePresetToggle = (presetId: string) => {
        setSelectedPresetIds((prev) => {
            const isSelecting = !prev.includes(presetId);
            
            if (presetId === 'blog-hero' && isSelecting) {
                // Show a mini-tip or confirmation for blog hero
                console.log("Optimizing for Blog Hero: 1600x900 (16:9)");
            }

            if (!isSelecting) {
                return prev.filter((id) => id !== presetId);
            } else {
                return [...prev, presetId];
            }
        });
    };
    
    const allPresets = useMemo(() => [ORIGINAL_PRESET, ...PRESET_GROUPS.flatMap((g) => g.options)], []);

    const selectedSummary = useMemo(() => {
        if (selectedPresetIds.length === 0) return "No sizes selected.";
        return allPresets
            .filter((p) => selectedPresetIds.includes(p.id))
            .map((p) => `${p.label} (${p.width || 'Original'}x${p.height || 'Original'})`)
            .join(', ');
    }, [selectedPresetIds, allPresets]);
    
    const slugify = (str: string) => str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const handleUpload = async () => {
        if (selectedPresetIds.length === 0) return;

        const supabase = getSupabaseClient();
        setIsUploading(true);
        setShowSuccessToast(false);

        const folderPath = slugify(folderName.trim());
        if (!folderPath) {
            alert("Post Slug is required for correct file mapping.");
            setIsUploading(false);
            return;
        }

        const activePresets = allPresets.filter((p) => selectedPresetIds.includes(p.id));

        for (let i = 0; i < files.length; i++) {
            const managedFile = files[i];
             try {
                if (managedFile.status !== 'queued' && managedFile.status !== 'error') continue;
                
                // Determine target folder for this specific file
                const fileTargetFolder = managedFile.folder ? slugify(managedFile.folder) : folderPath;

                for (const preset of activePresets) {
                    onUpdateFile(managedFile.id, { status: 'resizing' });
                    const dataUrl = await applyPrecisionCrop(managedFile.file, preset.width, preset.height, 'image/jpeg');
                    
                    const fileToUpload = dataURLtoBlob(dataUrl);

                    if (downloadEnabled) {
                        const link = document.createElement('a');
                        link.href = dataUrl;
                        link.download = `${fileTargetFolder}_[${preset.suffix}].jpg`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }

                    onUpdateFile(managedFile.id, { status: 'uploading' });
                    
                    // If the original filename has a structured tag, use it
                    let baseNameToken = `${i + 1}`;
                    if (managedFile.file.name.includes('-inline-1')) baseNameToken = 'inline-1';
                    else if (managedFile.file.name.includes('-inline-2')) baseNameToken = 'inline-2';
                    else if (managedFile.file.name.includes('-thumbnail')) baseNameToken = 'thumbnail';
                    else if (managedFile.file.name.includes(fileTargetFolder) && !managedFile.file.name.includes('-inline') && !managedFile.file.name.includes('-thumbnail')) baseNameToken = 'hero';

                    const fileName = `${fileTargetFolder}-${baseNameToken}-${preset.suffix}.jpg`;
                    const filePath = `${fileTargetFolder}/${fileName}`;
                    
                    const { error: uploadError } = await supabase.storage.from(uploadBucket).upload(filePath, fileToUpload, {
                        contentType: 'image/jpeg',
                        upsert: true 
                    });
                    
                    if (uploadError) throw uploadError;

                    // Get public URL for feedback
                    const { data: { publicUrl } } = supabase.storage.from(uploadBucket).getPublicUrl(filePath);
                    onUpdateFile(managedFile.id, { status: 'success', progress: 100, publicUrl });
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : "Error";
                onUpdateFile(managedFile.id, { status: 'error', error: message });
            }
        }

        setIsUploading(false);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 5000);
    };

    const flushProcessed = () => {
        // Find all successful files and remove them from the UI list
        const processedIds = files.filter(f => f.status === 'success').map(f => f.id);
        processedIds.forEach(id => onFileRemoved(id));
    };

    const clearQueue = () => {
        if (window.confirm("Purge entire upload queue?")) {
            onUploadComplete();
        }
    };

    const getButtonClass = (isSelected: boolean) => {
        return `
            group relative px-5 py-4 rounded-2xl text-[10px] font-black transition-all duration-300 border-2 flex flex-col items-center justify-center text-center uppercase tracking-widest overflow-hidden
            ${isSelected
                ? 'bg-orange-600 text-white border-white shadow-[0_15px_30px_rgba(234,88,12,0.3)] scale-105 z-10'
                : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border-slate-200 dark:border-gray-700 hover:border-orange-500/50 hover:bg-slate-50 dark:hover:bg-gray-750'
            }
        `;
    };

    const hasProcessedFiles = files.some(f => f.status === 'success');

    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 relative animate-fade-in">
             {showSuccessToast && (
                <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] animate-fade-in-down">
                    <div className="bg-green-600 text-white px-10 py-5 rounded-full shadow-2xl flex items-center gap-4 border-2 border-white">
                        <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                        <span className="font-black uppercase tracking-[0.2em] text-sm">Batch Processing Synchronized</span>
                    </div>
                </div>
            )}

            <div className="bg-slate-100 dark:bg-gray-950 border border-slate-200 dark:border-gray-900 p-10 rounded-[3rem] shadow-2xl">
                <div className="bg-orange-100 dark:bg-orange-950/30 border-2 border-orange-500/50 p-4 rounded-2xl mb-8 flex items-center gap-4">
                    <div className="bg-orange-600 text-white p-2 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-orange-700 dark:text-orange-400 leading-relaxed">
                        Pro-Tip: Keep Blog Heroes at <span className="text-orange-600 dark:text-orange-300">1600×900 (16:9)</span> JPG for maximum clarity on wide monitors (Target: 150KB–250KB).
                    </p>
                </div>

                <div className="flex justify-between items-center mb-6">
                    <div className="flex gap-4">
                        <button 
                            onClick={flushProcessed} 
                            disabled={!hasProcessedFiles || isUploading}
                            title="Clear images that have successfully finished"
                            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all flex items-center gap-2
                                ${hasProcessedFiles ? 'bg-orange-600 border-white text-white shadow-lg' : 'bg-slate-200 dark:bg-gray-800 border-slate-300 dark:border-gray-700 text-gray-400 opacity-50'}
                            `}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Flush Processed
                        </button>
                        <button 
                            onClick={clearQueue} 
                            disabled={files.length === 0 || isUploading}
                            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all flex items-center gap-2
                                ${files.length > 0 ? 'bg-slate-900 border-white text-white' : 'bg-slate-200 dark:bg-gray-800 border-slate-300 dark:border-gray-700 text-gray-400 opacity-50'}
                            `}
                        >
                            Reset Entire Queue
                        </button>
                    </div>
                    {files.length > 0 && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{files.length} Assets Active</span>
                    )}
                </div>

                <div {...getRootProps()} className={`w-full p-16 border-4 border-dashed rounded-[2rem] flex flex-col items-center justify-center text-center transition-all duration-300 ${isDragActive ? 'border-orange-500 bg-orange-500/5 scale-[0.99]' : 'border-slate-300 dark:border-gray-800 hover:border-orange-500 hover:bg-slate-200/50'}`}>
                    <input {...getInputProps()} />
                    <div className="bg-orange-600 p-4 rounded-full mb-6 text-white shadow-xl">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                        </svg>
                    </div>
                    <p className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Asset Multiplier</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-[0.4em] mt-3">Drop raw assets or click to browse</p>
                </div>
                {files.length > 0 && (
                    <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {files.map((f) => <FilePreview key={f.id} managedFile={f} onRemove={onFileRemoved} onUpdateFile={onUpdateFile} />)}
                    </div>
                )}
            </div>
            
            {(files.length > 0) && (
                <div className="bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 p-10 rounded-[3rem] shadow-xl space-y-10">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        <div className="lg:col-span-1 space-y-8">
                            <div className="bg-slate-50 dark:bg-gray-900 p-8 rounded-[2rem] border border-slate-100 dark:border-gray-800 shadow-inner">
                                <label className="block text-[10px] font-black text-orange-600 uppercase tracking-widest mb-4 ml-1">Destination Bucket</label>
                                <select 
                                    value={uploadBucket} 
                                    onChange={(e) => setUploadBucket(e.target.value)}
                                    className="w-full bg-white dark:bg-black border-2 border-transparent focus:border-orange-500 rounded-2xl p-5 text-sm outline-none font-black dark:text-white transition-all shadow-sm appearance-none cursor-pointer"
                                >
                                    <option value={SUPABASE_CONFIG.IMAGES_BUCKET}>Blog Images (Standard)</option>
                                    <option value={SUPABASE_CONFIG.GALLERY_BUCKET}>AI Gallery (Visible in App)</option>
                                </select>
                                <p className="text-[9px] text-gray-400 mt-4 uppercase tracking-widest">Choose where these assets will be stored in Supabase</p>
                            </div>

                            <div className="bg-slate-50 dark:bg-gray-900 p-8 rounded-[2rem] border border-slate-100 dark:border-gray-800 shadow-inner">
                                <label className="block text-[10px] font-black text-orange-600 uppercase tracking-widest mb-4 ml-1">Project Identifier (Slug)</label>
                                <input type="text" value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="e.g. car-insurance-tips-2025" className="w-full bg-white dark:bg-black border-2 border-transparent focus:border-orange-500 rounded-2xl p-5 text-sm outline-none font-black dark:text-white transition-all shadow-sm" />
                                <p className="text-[9px] text-gray-400 mt-4 uppercase tracking-widest">Required for filename structure and storage mapping</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-gray-900 p-6 rounded-[2rem] border border-slate-100 dark:border-gray-800">
                                <label className="flex items-center space-x-4 cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" checked={downloadEnabled} onChange={(e) => setDownloadEnabled(e.target.checked)} className="sr-only peer" />
                                        <div className="w-12 h-6 bg-slate-300 dark:bg-gray-700 rounded-full peer peer-checked:bg-orange-600 transition-colors"></div>
                                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
                                    </div>
                                    <span className="font-black text-[10px] uppercase text-gray-800 dark:text-gray-100 tracking-widest">Auto-Save Locally</span>
                                </label>
                            </div>
                        </div>

                        <div className="lg:col-span-2 space-y-8">
                             <div className="flex items-center justify-between mb-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Export Scale Profile</label>
                                <button onClick={() => setSelectedPresetIds([])} className="text-[9px] font-black text-orange-600 uppercase tracking-widest hover:underline">Reset</button>
                             </div>
                             
                             <div className="bg-slate-900 dark:bg-black border-2 border-slate-800 dark:border-orange-900/30 p-6 rounded-3xl text-[11px] font-black text-orange-500 uppercase tracking-widest text-center min-h-[60px] flex items-center justify-center leading-relaxed">
                                 {selectedSummary}
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {PRESET_GROUPS.map((group) => (
                                     <div key={group.name} className="space-y-4">
                                         <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] border-b border-slate-100 dark:border-gray-800 pb-2 ml-1">{group.name}</h4>
                                         <div className="grid grid-cols-2 gap-3">
                                             {group.options.map((o) => (
                                                 <button key={o.id} onClick={() => handlePresetToggle(o.id)} className={getButtonClass(selectedPresetIds.includes(o.id))}>
                                                     <span className="mb-1">{o.label}</span>
                                                     <span className={`text-[8px] opacity-60 font-medium ${selectedPresetIds.includes(o.id) ? 'text-white' : 'text-gray-500'}`}>{o.width} x {o.height}</span>
                                                 </button>
                                             ))}
                                         </div>
                                     </div>
                                ))}
                                <div className="space-y-4">
                                     <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] border-b border-slate-100 dark:border-gray-800 pb-2 ml-1">Universal</h4>
                                     <button onClick={() => handlePresetToggle(ORIGINAL_PRESET.id)} className={getButtonClass(selectedPresetIds.includes(ORIGINAL_PRESET.id)) + " w-full h-[88px]"}>
                                        <span className="mb-1">{ORIGINAL_PRESET.label}</span>
                                        <span className={`text-[8px] opacity-60 font-medium ${selectedPresetIds.includes(ORIGINAL_PRESET.id) ? 'text-white' : 'text-gray-500'}`}>{ORIGINAL_PRESET.description}</span>
                                    </button>
                                </div>
                             </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleUpload} 
                        disabled={isUploading || selectedPresetIds.length === 0 || !folderName.trim()} 
                        className="w-full relative bg-orange-600 text-white border-4 border-white font-black py-8 rounded-[2rem] shadow-[0_25px_50px_-12px_rgba(234,88,12,0.4)] transition-all active:scale-[0.98] uppercase tracking-[0.3em] text-xl hover:bg-orange-700 disabled:bg-slate-300 disabled:border-slate-200"
                    >
                        {isUploading ? (
                            <div className="flex items-center justify-center gap-4">
                                <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Batch Sync in Progress...</span>
                            </div>
                        ) : 'Transmit Digital Content'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default Uploader;
