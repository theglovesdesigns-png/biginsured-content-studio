
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useGeneratorSettings } from '../hooks/useGeneratorSettings';
import { generateImage } from '../services/geminiService';
import { saveToGallery } from '../services/galleryService';
import { applyPrecisionCrop, parseRatioToDimensions } from '../services/imageUtils';
import { AspectRatio, GeneratorPrompt } from '../types';
import ErrorDisplay from './ErrorDisplay';
import GeneratedImage from './GeneratedImage';
import ImageEditor from './ImageEditor';
import RichPromptEditor from './RichPromptEditor';

interface GeneratedResult {
    id: string;
    src: string;
    prompt: string;
    negativePrompt: string;
    aspectRatio: AspectRatio;
    isHighQuality: boolean;
}

interface ImageGeneratorProps {
    onAddToUploadQueue: (image: { url: string, name: string }) => void;
    externalPrompt?: GeneratorPrompt | null;
    onPromptConsumed?: () => void;
}

const WebIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>;

const BIG_SITE_PRESETS: { ratio: AspectRatio; label: string; description: string; icon: React.ReactNode }[] = [
    { ratio: '1600x533', label: 'Service Section', description: '1600 x 533 px (3:1)', icon: <WebIcon /> },
    { ratio: '1920x600', label: 'Blog Hero Image', description: '1920 x 600 px (3.2:1)', icon: <WebIcon /> },
    { ratio: '1280x720', label: 'YouTube Thumbnail', description: '1280 x 720 px (16:9)', icon: <WebIcon /> },
    { ratio: '1080x1350', label: 'Instagram (Portrait)', description: '1080 x 1350 px (4:5)', icon: <div className="w-4 h-4 border-2 rounded-sm border-current" /> },
    { ratio: '1200x630', label: 'Facebook Feed', description: '1200 x 630 px (1.91:1)', icon: <div className="w-4 h-4 border-2 rounded-sm border-current" /> }
];

const generateSmartFilename = (prompt: string, aspectRatio: string, metadata?: GeneratorPrompt['metadata']) => {
    if (metadata && metadata.slug) {
        const typeSuffix = metadata.imageType === 'hero' ? '' : `-${metadata.imageType.replace('_', '-')}`;
        const today = new Date();
        const formattedDate = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;
        
        return `${metadata.slug}${typeSuffix}_[${aspectRatio.replace(':', 'x')}]_${formattedDate}.jpg`;
    }

    const keywords = prompt.toLowerCase().replace(/[^a-z0-9\s]/gi, '').split(' ').filter(word => word.length > 3).slice(0, 4).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('_');
    const safeKeywords = keywords || 'Generated_Image';
    let ratioLabel = aspectRatio.replace(':', 'x');
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;
    return `${safeKeywords}_[${ratioLabel}]_${formattedDate}.jpg`;
};

const EXCLUSION_CHOICES = [
    'Text', 'Logos', 'Watermarks', 'Signs', 'People', 'Blurry', 'Low-res', 'UI Elements', 'Messy Edges'
];

// Consolidated tag categories — merges what used to be split between the
// top "Style Engine" boosts and the separate PromptSnippets block below the
// fold. Nothing here is duplicated; each category has distinct, non-overlapping
// options so there's exactly one place to build a prompt visually.
const TAG_CATEGORIES: { name: string; tags: string[] }[] = [
    {
        name: 'Style',
        tags: [
            'Shot on 35mm', 'Cinematic', 'Hyperrealistic', '3D Render', 'Minimalist',
            'Watercolor', 'Architectural Visualization', 'Editorial Photography',
            'Dark Moody Realism', 'Flat Design Illustration', 'Retro Analog Film',
            'Ohio Architecture', 'Midwest Landscape', 'Modern Office', 'Macro Focus',
        ],
    },
    {
        name: 'Camera Angle',
        tags: [
            'Centered Full View', 'Safe Margins', 'Wide Field of Vision', 'Panorama',
            'Deep Depth of Field', 'Symmetrical', 'Dynamic angle', 'Aerial Drone',
        ],
    },
    {
        name: 'Quality',
        tags: [
            'Sharp focus', 'Intricate detail', 'UHD', 'Photorealistic rendering',
            'Professional color grading', 'Studio-quality output', 'Professional Detail',
        ],
    },
];

// Lighting & Tone — replaces the old single-select "mood" buttons with the
// same multi-tag pattern as everything else, and absorbs every lighting
// option that used to live in the separate PromptSnippets block.
const LIGHTING_TAGS = [
    'Natural Lighting', 'Golden Hour', 'Studio Lighting', 'Volumetric Lighting',
    'Rembrandt Lighting', 'Neon Urban Night Lighting', 'Soft Diffused Natural Light',
    'Local Ohio Vibe', 'Muted/Authentic',
];

// Clickable season picker — inserts a concrete seasonal modifier into the prompt
// so generations match the actual time of year being written about, instead of
// the model guessing (and needing manual prompt edits afterward).
const SEASONS = [
    { id: 'spring', label: 'Spring', modifier: 'Early spring season, blooming trees, fresh green growth, mild weather' },
    { id: 'summer', label: 'Summer', modifier: 'Peak summer season, lush full foliage, bright sunny day, warm atmosphere' },
    { id: 'fall', label: 'Fall', modifier: 'Autumn season, fall foliage with orange and red leaves, crisp clear light' },
    { id: 'winter', label: 'Winter', modifier: 'Winter season, snow-covered ground, bare trees, cold crisp atmosphere' },
];

// Clickable US region picker — keeps generated scenery/architecture consistent
// with the part of the country the blog post is actually about.
const US_REGIONS = [
    { id: 'ohio', label: 'Ohio / Canal Winchester', modifier: 'Central Ohio suburban setting, Canal Winchester style architecture, Midwest neighborhood' },
    { id: 'midwest', label: 'Midwest', modifier: 'General Midwest United States setting, classic American suburban architecture' },
    { id: 'east_coast', label: 'East Coast', modifier: 'East Coast United States setting, coastal Northeast architecture and landscape' },
    { id: 'south', label: 'South', modifier: 'Southern United States setting, warm climate architecture and landscape' },
    { id: 'west_coast', label: 'West Coast', modifier: 'West Coast United States setting, Pacific architecture and landscape' },
    { id: 'national', label: 'National (No Region)', modifier: '' },
];

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ onAddToUploadQueue, externalPrompt, onPromptConsumed }) => {
    const {
        prompt, setPrompt,
        negativePrompt, setNegativePrompt,
        aspectRatios, toggleAspectRatio,
        selectedSnippets, toggleSnippet,
        isHighQuality, setIsHighQuality,
        addPromptToHistory,
    } = useGeneratorSettings();

    const [generatedImages, setGeneratedImages] = useState<GeneratedResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingImage, setEditingImage] = useState<GeneratedResult | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<GeneratorPrompt['metadata'] | undefined>(externalPrompt?.metadata);

    // Initial negative prompt enforcement for BIGINSURED brand
    useEffect(() => {
        if (!negativePrompt || negativePrompt === 'text, watermark, ugly, blurry, deformed') {
            setNegativePrompt('text, words, letters, font, logo, brand, watermark, insignia, blurry, low-res, UI, interface, messy edges');
        }
    }, []);

    useEffect(() => {
        if (externalPrompt) {
            setPrompt(externalPrompt.text);
            setMetadata(externalPrompt.metadata);
            if (onPromptConsumed) onPromptConsumed();
        }
    }, [externalPrompt, setPrompt, onPromptConsumed]);

    const toggleExclusion = (exclusion: string) => {
        const currentExclusions = negativePrompt.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const lowerExclusion = exclusion.toLowerCase();
        
        if (currentExclusions.includes(lowerExclusion)) {
            setNegativePrompt(currentExclusions.filter(s => s !== lowerExclusion).join(', '));
        } else {
            setNegativePrompt([...currentExclusions, lowerExclusion].join(', '));
        }
    };

    const insertToPrompt = (text: string) => {
        const parts = prompt.split(',').map(p => p.trim()).filter(Boolean);
        const lowerText = text.toLowerCase();
        const hasText = parts.some(p => p.toLowerCase() === lowerText);
        
        if (hasText) {
            const filteredParts = parts.filter(p => p.toLowerCase() !== lowerText);
            setPrompt(filteredParts.join(', '));
        } else {
            setPrompt(prev => prev.trim() ? `${prev.trim()}, ${text}` : text);
        }
    };
    
    const handleGenerate = useCallback(async () => {
        if (isLoading) return;
        setIsLoading(true);
        setError(null);
        
        if (prompt.trim()) addPromptToHistory(prompt);
        
        const seasonModifier = SEASONS.find(s => s.id === selectedSeason)?.modifier || '';
        const regionModifier = US_REGIONS.find(r => r.id === selectedRegion)?.modifier || '';
        const contextModifiers = [seasonModifier, regionModifier].filter(Boolean).join(', ');

        const finalVisualPrompt = selectedSnippets.length > 0
            ? `${metadata?.slug ? `[Subject: ${metadata.slug.replace(/-/g, ' ')}] ` : ''}${prompt.trim()}${contextModifiers ? `, ${contextModifiers}` : ''}, ${selectedSnippets.join(', ')}`
            : `${metadata?.slug ? `[Subject: ${metadata.slug.replace(/-/g, ' ')}] ` : ''}${prompt.trim()}${contextModifiers ? `, ${contextModifiers}` : ''}`;

        try {
            setGeneratedImages([]); 
            const imagePromises = aspectRatios.map(async (ratio) => {
                const base64Raw = await generateImage(finalVisualPrompt, negativePrompt, ratio, isHighQuality);
                const dims = parseRatioToDimensions(ratio);
                const croppedSrc = await applyPrecisionCrop(`data:image/jpeg;base64,${base64Raw}`, dims.width, dims.height, 'image/webp');
                
                return {
                    id: uuidv4(),
                    src: croppedSrc,
                    prompt: finalVisualPrompt,
                    negativePrompt: negativePrompt,
                    aspectRatio: ratio,
                    isHighQuality: isHighQuality,
                };
            });

            const results = await Promise.all(imagePromises);
            setGeneratedImages(results);

        } catch (err) {
            if (err instanceof Error) setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [prompt, negativePrompt, aspectRatios, selectedSnippets, isHighQuality, addPromptToHistory, isLoading, selectedSeason, selectedRegion, metadata]);

    const handleGenerateVariation = async (originalImage: GeneratedResult) => {
        setIsLoading(true);
        setError(null);
        try {
            const variationPrompt = `[VARIATION]: A different artistic perspective of: ${originalImage.prompt}. Consistent style, new composition.`;
            const base64Raw = await generateImage(variationPrompt, originalImage.negativePrompt, originalImage.aspectRatio, originalImage.isHighQuality);
            const dims = parseRatioToDimensions(originalImage.aspectRatio);
            const croppedSrc = await applyPrecisionCrop(`data:image/jpeg;base64,${base64Raw}`, dims.width, dims.height, 'image/webp');
            
            const newImage: GeneratedResult = {
                id: uuidv4(),
                src: croppedSrc,
                prompt: originalImage.prompt,
                negativePrompt: originalImage.negativePrompt,
                aspectRatio: originalImage.aspectRatio,
                isHighQuality: originalImage.isHighQuality,
            };
            
            setGeneratedImages(prev => [newImage, ...prev]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Variation failed.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSaveToGallery = async (image: GeneratedResult) => {
        try {
            const res = await fetch(image.src);
            const blob = await res.blob();
            await saveToGallery({
                prompt: image.prompt,
                negative_prompt: image.negativePrompt,
                aspect_ratio: image.aspectRatio
            }, blob);
            return true;
        } catch (error) {
            console.error("Gallery persistence error:", error);
            throw error;
        }
    };

    const handleClearPrompt = () => setPrompt('');

    const getButtonClass = (isSelected: boolean) => {
        const baseClass = "group relative p-4 rounded-[1.5rem] text-left border-2 flex flex-col justify-center transition-all duration-300 transform hover:scale-[1.02] active:scale-95 focus:outline-none overflow-hidden";
        return isSelected 
            ? `${baseClass} bg-orange-600 border-white text-white shadow-[0_10px_30px_rgba(234,88,12,0.2)] z-10`
            : `${baseClass} bg-white dark:bg-gray-800/80 border-slate-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-orange-500/50`;
    };

    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 relative">
            {isLoading && (
                <div className="fixed inset-0 bg-white/80 dark:bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center rounded-[2.5rem] animate-fade-in">
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 border-4 border-slate-800 border-t-orange-500 rounded-full animate-spin mb-4"></div>
                        <p className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white text-center">Architecting Your Visual Brief<br/><span className="text-xs font-medium text-orange-600">Optimizing Composition & Safe Margins...</span></p>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <div className="flex flex-col gap-8 relative z-10">
                    <div>
                         <div className="flex justify-between items-center mb-3">
                            <label className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                <span className="w-2 h-2 bg-orange-600 rounded-full"></span>
                                Primary Concept & Details
                            </label>
                            <div className="flex gap-2 items-center">
                                <span className="hidden sm:block text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-gray-900 px-2 py-1 rounded border border-slate-100 dark:border-gray-800">
                                    Pro Tip: Describe the environment and specific objects
                                </span>
                                <button onClick={handleClearPrompt} className="text-[9px] font-black uppercase bg-slate-100 dark:bg-gray-800 px-3 py-1.5 rounded-full text-gray-500 hover:text-red-500 transition-colors">Clear Box</button>
                            </div>
                        </div>
                        <RichPromptEditor value={prompt} onChange={setPrompt} placeholder="Example: A cozy living room in an Ohio suburb during autumn, warm fireplace, local woodwork..." />

                        {/* Consolidated tag categories — one place to build the prompt visually.
                            Lighting & Tone, Style, Camera Angle, and Quality, each with distinct
                            non-overlapping options. Replaces the old split between the top
                            "Style Engine" boosts and the separate PromptSnippets block. */}
                        <div className="mt-5 space-y-4">
                            <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Lighting &amp; Tone Engine</span>
                                <div className="flex flex-wrap gap-2">
                                    {LIGHTING_TAGS.map(tag => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => toggleSnippet(tag)}
                                            className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-full transition-all border ${
                                                selectedSnippets.includes(tag)
                                                ? 'bg-orange-600 border-orange-600 text-white shadow-md font-bold'
                                                : 'bg-slate-100 dark:bg-gray-800 text-gray-500 hover:text-orange-600 hover:bg-orange-50 border-transparent hover:border-orange-200/50'
                                            }`}
                                        >
                                            {selectedSnippets.includes(tag) ? '✓' : '+'} {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {TAG_CATEGORIES.map(category => (
                                <div key={category.name}>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">{category.name} Engine</span>
                                    <div className="flex flex-wrap gap-2">
                                        {category.tags.map(tag => (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => toggleSnippet(tag)}
                                                className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-full transition-all border ${
                                                    selectedSnippets.includes(tag)
                                                    ? 'bg-orange-600 border-orange-600 text-white shadow-md font-bold'
                                                    : 'bg-slate-100 dark:bg-gray-800 text-gray-500 hover:text-orange-600 hover:bg-orange-50 border-transparent hover:border-orange-200/50'
                                                }`}
                                            >
                                                {selectedSnippets.includes(tag) ? '✓' : '+'} {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Filter Exclusions now lives directly under Style Engine, same section */}
                        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-gray-900">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Filter Exclusions (Negative)</label>
                            <input type="text" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} className="w-full bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-3.5 text-xs outline-none focus:border-orange-500 dark:text-white font-bold" placeholder="e.g., text, watermark, messy edges..." />
                            <div className="flex flex-wrap gap-2 mt-3">
                                {EXCLUSION_CHOICES.map(choice => {
                                    const isActive = negativePrompt.toLowerCase().includes(choice.toLowerCase());
                                    return (
                                        <button
                                            key={choice}
                                            onClick={() => toggleExclusion(choice)}
                                            className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-full transition-all ${
                                                isActive
                                                ? 'bg-orange-600 text-white'
                                                : 'bg-slate-100 dark:bg-gray-800 text-gray-500 hover:text-orange-600 hover:bg-orange-50'
                                            }`}
                                        >
                                            {choice}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Season picker — inserts a concrete time-of-year modifier so generations
                            stop defaulting to whatever season the model assumes. */}
                        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-gray-900">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Time of Year</label>
                            <div className="flex flex-wrap gap-2">
                                {SEASONS.map(season => (
                                    <button
                                        key={season.id}
                                        onClick={() => setSelectedSeason(prev => prev === season.id ? null : season.id)}
                                        className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-full transition-all border ${
                                            selectedSeason === season.id
                                            ? 'bg-orange-600 border-orange-600 text-white shadow-md'
                                            : 'bg-slate-100 dark:bg-gray-800 text-gray-500 hover:text-orange-600 hover:bg-orange-50 border-transparent hover:border-orange-200/50'
                                        }`}
                                    >
                                        {selectedSeason === season.id ? '✓' : '+'} {season.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* US Region picker — keeps generated architecture/scenery consistent
                            with whichever part of the country the post is actually about. */}
                        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-gray-900">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">US Region</label>
                            <div className="flex flex-wrap gap-2">
                                {US_REGIONS.map(region => (
                                    <button
                                        key={region.id}
                                        onClick={() => setSelectedRegion(prev => prev === region.id ? null : region.id)}
                                        className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-full transition-all border ${
                                            selectedRegion === region.id
                                            ? 'bg-orange-600 border-orange-600 text-white shadow-md'
                                            : 'bg-slate-100 dark:bg-gray-800 text-gray-500 hover:text-orange-600 hover:bg-orange-50 border-transparent hover:border-orange-200/50'
                                        }`}
                                    >
                                        {selectedRegion === region.id ? '✓' : '+'} {region.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-gray-900 pt-8">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 block">Composition Engine: Layouts</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {BIG_SITE_PRESETS.map(({ratio, label, icon}) => (
                                <button key={ratio} onClick={() => toggleAspectRatio(ratio)} className={getButtonClass(aspectRatios.includes(ratio)) + ' !p-3'}>
                                    <div className="flex items-center gap-2">
                                        <span className={`p-1 rounded ${aspectRatios.includes(ratio) ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400'}`}>{icon}</span>
                                        <span className="font-black text-[10px] uppercase tracking-tight leading-tight">{label}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 flex justify-center">
                         <label className="flex items-center gap-4 cursor-pointer bg-slate-50 dark:bg-gray-900 p-4 px-6 rounded-2xl border border-slate-100 dark:border-gray-800 hover:border-orange-500 transition-colors">
                             <input type="checkbox" checked={isHighQuality} onChange={() => setIsHighQuality()} className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500" />
                             <div>
                                 <span className="block text-[10px] font-black uppercase text-slate-900 dark:text-white tracking-widest">Quality Engine: Intelligence Mode</span>
                                 <span className="block text-[9px] text-gray-500 uppercase">{isHighQuality ? 'Pro Model (Best Quality)' : 'Flash Model (Fast Response)'}</span>
                             </div>
                         </label>
                    </div>

                    <div className="mt-6 relative">
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || !prompt.trim()}
                            className="relative w-full py-6 bg-orange-600 text-white font-black text-xl uppercase tracking-tighter rounded-3xl shadow-[0_20px_40px_-15px_rgba(234,88,12,0.4)] transform transition-all hover:-translate-y-1 active:scale-[0.98] disabled:bg-slate-400 border-2 border-transparent hover:border-white"
                        >
                            Generate {aspectRatios.length} Vision{aspectRatios.length > 1 ? 's' : ''}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
                {generatedImages.map(image => (
                    <GeneratedImage 
                        key={image.id} 
                        image={image} 
                        onEdit={() => setEditingImage(image)} 
                        onAddToUploadQueue={() => onAddToUploadQueue({ 
                            url: image.src, 
                            name: generateSmartFilename(image.prompt, image.aspectRatio, metadata),
                            folder: metadata?.slug
                        })} 
                        onGenerateVariation={() => handleGenerateVariation(image)} 
                        onSaveToGallery={() => handleSaveToGallery(image)} 
                    />
                ))}
            </div>
            
            {editingImage && <ImageEditor src={editingImage.src} onClose={() => setEditingImage(null)} onSave={(src) => setGeneratedImages(prev => prev.map(img => img.id === editingImage.id ? {...img, src} : img))} />}
            {error && <ErrorDisplay message={error} onRetry={handleGenerate} />}
        </div>
    );
};

export default ImageGenerator;
