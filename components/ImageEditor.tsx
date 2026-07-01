
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Database } from 'lucide-react';
import { editImage } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import { useTheme } from './ThemeProvider';

type EditMode = 'crop' | 'refine' | 'text' | 'overlay' | 'strategy';

interface SocialGuide {
    id: string;
    name: string;
    aspectRatio: string;
    tips: string[];
    safeZone?: { x: number, y: number, w: number, h: number }; // Percentage based
}

const SOCIAL_STRATEGIES: SocialGuide[] = [
    {
        id: 'yt-thumb',
        name: 'YouTube Thumbnail',
        aspectRatio: '16:9',
        tips: [
            'High contrast text on right side (avoid bottom right clock)',
            'Faces with extreme emotions increase CTR by 38%',
            'Arrows or circles pointing to a focal point',
            'Saturated colors (vibrance +20%) work best'
        ],
        safeZone: { x: 5, y: 5, w: 75, h: 80 } // Avoiding bottom-right UI
    },
    {
        id: 'ig-carousel',
        name: 'IG Carousel (Portrait)',
        aspectRatio: '4:5',
        tips: [
            'Slide 1: High-stakes "Hook" question',
            'Slide 2-4: Micro-steps or educational value',
            'Keep text in the middle 60% for cropping safety',
            'Last slide MUST be a clear CTA: "Save this"'
        ],
        safeZone: { x: 10, y: 15, w: 80, h: 70 }
    },
    {
        id: 'fb-feed',
        name: 'Facebook Feed',
        aspectRatio: '1.91:1',
        tips: [
            'Shareable "Viral" style visuals perform best',
            'User-generated content (UGC) feels more authentic',
            'Avoid too much text in the image (20% rule)',
            'Emotional or nostalgic imagery triggers shares'
        ],
        safeZone: { x: 10, y: 10, w: 80, h: 80 }
    }
];

interface TextOverlay {
    text: string;
    font: string;
    color: string;
    size: number;
    x: number;
    y: number;
    opacity: number;
}

interface ImageEditorProps {
    src: string;
    onClose: () => void;
    onSave: (newSrc: string) => void;
}

const CropIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M15 2a1 1 0 00-1 1v2H6V3a1 1 0 10-2 0v2H3a1 1 0 00-1 1v10a1 1 0 001 1h1v1a1 1 0 102 0v-1h8v1a1 1 0 102 0v-1h1a1 1 0 001-1V6a1 1 0 00-1-1h-1V3a1 1 0 00-1-1zm-1 4H6v8h8V6z" />
    </svg>
);

const RefineIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0V6h-1a1 1 0 110-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
);

const TextIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9.25 3a.75.75 0 01.75.75V5h4.25a.75.75 0 010 1.5H10v8.5a.75.75 0 01-1.5 0V6.5H4.25a.75.75 0 010-1.5H8.5V3.75a.75.75 0 01.75-.75z" clipRule="evenodd" />
    </svg>
);

const YouTubeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
    </svg>
);

const ImageEditor: React.FC<ImageEditorProps> = ({ src, onClose, onSave }) => {
    const { theme } = useTheme();
    const [mode, setMode] = useState<EditMode>('crop');
    const [history, setHistory] = useState<string[]>([]);
    const [currentImage, setCurrentImage] = useState<string>(src);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [isSaved, setIsSaved] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [textEditPrompt, setTextEditPrompt] = useState<string>('');
    const [showYouTubeGuide, setShowYouTubeGuide] = useState(false);
    const [activeGuide, setActiveGuide] = useState<SocialGuide | null>(null);
    const [is16by9, setIs16by9] = useState(false);
    
    // Manual Text Overlay State
    const [overlay, setOverlay] = useState<TextOverlay>({
        text: '',
        font: 'Space Grotesk',
        color: '#FFFFFF',
        size: 60,
        x: 50,
        y: 50,
        opacity: 1
    });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const interactionCanvasRef = useRef<HTMLCanvasElement>(null);
    const mainContainerRef = useRef<HTMLDivElement>(null);

    const isDrawing = useRef(false);
    const cropStartPoint = useRef<{ x: number; y: number } | null>(null);
    const cropRect = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
    const refinePaths = useRef<Array<{ x: number; y: number }[]>>([]);
    const [hasInteraction, setHasInteraction] = useState(false);

    const pushToHistory = useCallback((imageData: string) => {
        setHistory(prev => [...prev, imageData]);
        setCurrentImage(imageData);
    }, []);

    const undo = () => {
        if (history.length > 1) {
            const newHistory = [...history];
            newHistory.pop();
            const previousImage = newHistory[newHistory.length-1];
            setHistory(newHistory);
            setCurrentImage(previousImage);
        }
    }

    const clearInteractionCanvas = useCallback(() => {
        const canvas = interactionCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, []);

    const drawImage = useCallback((imageUrl: string) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = imageUrl;
        image.onload = () => {
            const canvas = canvasRef.current;
            const interactionCanvas = interactionCanvasRef.current;
            const container = mainContainerRef.current;

            if (canvas && interactionCanvas && container) {
                    const maxWidth = container.clientWidth - 32;
                    const maxHeight = container.clientHeight - 32;
                    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
                    canvas.width = image.width * scale;
                    canvas.height = image.height * scale;
                    interactionCanvas.width = canvas.width;
                    interactionCanvas.height = canvas.height;
                    
                    const aspectRatio = canvas.width / canvas.height;
                    setIs16by9(Math.abs(aspectRatio - 16 / 9) < 0.02);

                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);
            }
        };
    }, []);
    
    useEffect(() => {
        if (history.length === 0) {
            pushToHistory(src);
        }
    }, [src, pushToHistory, history.length]);

    useEffect(() => {
        drawImage(currentImage);
        const handleResize = () => drawImage(currentImage);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [currentImage, drawImage]);

    useEffect(() => {
        const canvas = interactionCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (showYouTubeGuide || activeGuide) {
            const { width, height } = canvas;

            if (activeGuide && activeGuide.safeZone) {
                const { x, y, w, h } = activeGuide.safeZone;
                const safeX = (x / 100) * width;
                const safeY = (y / 100) * height;
                const safeWidth = (w / 100) * width;
                const safeHeight = (h / 100) * height;

                ctx.setLineDash([10, 10]);
                ctx.strokeStyle = 'rgba(234, 88, 12, 0.8)';
                ctx.lineWidth = 3;
                ctx.strokeRect(safeX, safeY, safeWidth, safeHeight);

                // Overlay outside
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.fillRect(0, 0, width, safeY);
                ctx.fillRect(0, safeY + safeHeight, width, height - (safeY + safeHeight));
                ctx.fillRect(0, safeY, safeX, safeHeight);
                ctx.fillRect(safeX + safeWidth, safeY, width - (safeX + safeWidth), safeHeight);
                ctx.setLineDash([]);
            } else if (showYouTubeGuide) {
                const marginX = width * 0.05;
                const marginY = height * 0.1;
                const safeX = marginX;
                const safeY = marginY;
                const safeWidth = width - (marginX * 2);
                const safeHeight = height - (marginY * 2);
                
                ctx.setLineDash([8, 4]);
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
                ctx.lineWidth = 2;
                ctx.strokeRect(safeX, safeY, safeWidth, safeHeight);

                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.fillRect(0, 0, width, safeY);
                ctx.fillRect(0, safeY + safeHeight, width, height - (safeY + safeHeight));
                ctx.fillRect(0, safeY, safeX, safeHeight);
                ctx.fillRect(safeX + safeWidth, safeY, width - (safeX + safeWidth), safeHeight);

                ctx.setLineDash([]);
            }
        }

        if (mode === 'overlay' && overlay.text) {
            const { width, height } = canvas;
            ctx.fillStyle = overlay.color;
            ctx.globalAlpha = overlay.opacity;
            ctx.font = `bold ${overlay.size * (width / 1000)}px "${overlay.font}"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Add subtle shadow for legibility
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            const posX = (overlay.x / 100) * width;
            const posY = (overlay.y / 100) * height;
            
            ctx.fillText(overlay.text, posX, posY);
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.globalAlpha = 1;
        }

    }, [showYouTubeGuide, activeGuide, currentImage, mode, overlay]);

    const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = interactionCanvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (showYouTubeGuide || isProcessing) return;
        const point = getCanvasPoint(e);
        if (!point) return;
        isDrawing.current = true;
        if (mode === 'crop') {
            cropStartPoint.current = point;
            cropRect.current = null;
        } else if (mode === 'refine') {
            refinePaths.current.push([point]);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current || showYouTubeGuide || isProcessing) return;
        const point = getCanvasPoint(e);
        if (!point) return;

        clearInteractionCanvas();
        const canvas = interactionCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;

        if (mode === 'crop' && cropStartPoint.current) {
            const { x, y } = cropStartPoint.current;
            const w = point.x - x;
            const h = point.y - y;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(x, y, w, h);
            cropRect.current = { x, y, w, h };
        } else if (mode === 'refine') {
            const currentPath = refinePaths.current[refinePaths.current.length - 1];
            currentPath.push(point);
            
            ctx.strokeStyle = 'rgba(255, 0, 255, 0.7)';
            ctx.lineWidth = 20;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            refinePaths.current.forEach(path => {
                ctx.beginPath();
                ctx.moveTo(path[0].x, path[0].y);
                path.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();
            });
        }
    };

    const handleMouseUp = () => {
        if (showYouTubeGuide || isProcessing) return;
        isDrawing.current = false;
        if (mode === 'crop' && cropRect.current) {
            setHasInteraction(true);
        } else if (mode === 'refine' && refinePaths.current.length > 0 && refinePaths.current[refinePaths.current.length-1].length > 1) {
            setHasInteraction(true);
        }
        if (mode === 'crop') {
             cropStartPoint.current = null;
        }
    };
    
    const applyCrop = () => {
        if (!cropRect.current) return;
        const mainCanvas = canvasRef.current;
        if (!mainCanvas) return;

        const originalImage = new Image();
        originalImage.crossOrigin = "anonymous";
        originalImage.onload = () => {
            const scaleX = originalImage.naturalWidth / mainCanvas.width;
            const scaleY = originalImage.naturalHeight / mainCanvas.height;

            const { x, y, w, h } = cropRect.current!;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = Math.abs(w) * scaleX;
            tempCanvas.height = Math.abs(h) * scaleY;
            const tempCtx = tempCanvas.getContext('2d');
            
            if (tempCtx) {
                tempCtx.drawImage(
                    originalImage,
                    (w < 0 ? x + w : x) * scaleX,
                    (h < 0 ? y + h : y) * scaleY,
                    Math.abs(w) * scaleX,
                    Math.abs(h) * scaleY,
                    0,
                    0,
                    tempCanvas.width,
                    tempCanvas.height
                );

                pushToHistory(tempCanvas.toDataURL('image/jpeg'));
            }
            cropRect.current = null;
            clearInteractionCanvas();
            setHasInteraction(false);
        };
        originalImage.src = currentImage;
    };

    const applyRefine = async () => {
        if (refinePaths.current.length === 0) return;
        setIsProcessing(true);
        setError(null);
        
        try {
            const mainCanvas = canvasRef.current;
            if (!mainCanvas) throw new Error("Canvas not found");
            
            const originalImage = new Image();
            originalImage.src = currentImage;
            await new Promise(resolve => {
                originalImage.onload = resolve;
                originalImage.onerror = () => resolve(null);
            });

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = originalImage.naturalWidth;
            tempCanvas.height = originalImage.naturalHeight;
            const tempCtx = tempCanvas.getContext('2d');
            if(!tempCtx) throw new Error("Could not create temp context");

            tempCtx.drawImage(originalImage, 0, 0);

            const scaleX = originalImage.naturalWidth / mainCanvas.width;
            const scaleY = originalImage.naturalHeight / mainCanvas.height;

            tempCtx.strokeStyle = '#FF00FF';
            tempCtx.lineWidth = 20 * Math.max(scaleX, scaleY);
            tempCtx.lineCap = 'round';
            tempCtx.lineJoin = 'round';
            refinePaths.current.forEach(path => {
                tempCtx.beginPath();
                tempCtx.moveTo(path[0].x * scaleX, path[0].y * scaleY);
                path.forEach(point => tempCtx.lineTo(point.x * scaleX, point.y * scaleY));
                tempCtx.stroke();
            });

            const modifiedImageDataUrl = tempCanvas.toDataURL('image/jpeg');
            const base64Data = modifiedImageDataUrl.split(',')[1];

            const refinedBase64 = await editImage(
                base64Data,
                'image/jpeg',
                'Inpaint the magenta area to seamlessly match the surrounding background. REMOVE ALL LOGOS AND TEXT. Ensure the area looks completely natural and unbranded.'
            );
            
            pushToHistory(`data:image/jpeg;base64,${refinedBase64}`);

        } catch (err) {
             setError(err instanceof Error ? err.message : "Refinement failed.");
        } finally {
             setIsProcessing(false);
             refinePaths.current = [];
             clearInteractionCanvas();
             setHasInteraction(false);
        }
    };
    
    const applyTextEdit = async () => {
        if (!textEditPrompt.trim()) return;
        setIsProcessing(true);
        setError(null);
        
        try {
            const mainCanvas = canvasRef.current;
            if (!mainCanvas) throw new Error("Canvas not found");

            const imageDataUrl = mainCanvas.toDataURL('image/jpeg');
            const base64Data = imageDataUrl.split(',')[1];

            const editedBase64 = await editImage(
                base64Data,
                'image/jpeg',
                textEditPrompt
            );
            
            pushToHistory(`data:image/jpeg;base64,${editedBase64}`);
            setTextEditPrompt("");

        } catch (err) {
             setError(err instanceof Error ? err.message : "Text edit failed.");
        } finally {
             setIsProcessing(false);
        }
    };

    const applyOverlay = () => {
        if (!overlay.text) return;
        const mainCanvas = canvasRef.current;
        if (!mainCanvas) return;

        const originalImage = new Image();
        originalImage.crossOrigin = "anonymous";
        originalImage.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = originalImage.naturalWidth;
            tempCanvas.height = originalImage.naturalHeight;
            const tempCtx = tempCanvas.getContext('2d');
            
            if (tempCtx) {
                tempCtx.drawImage(originalImage, 0, 0);
                
                const width = tempCanvas.width;
                const height = tempCanvas.height;
                
                tempCtx.fillStyle = overlay.color;
                tempCtx.globalAlpha = overlay.opacity;
                tempCtx.font = `bold ${overlay.size * (width / 1000)}px "${overlay.font}"`;
                tempCtx.textAlign = 'center';
                tempCtx.textBaseline = 'middle';
                
                tempCtx.shadowColor = 'rgba(0,0,0,0.5)';
                tempCtx.shadowBlur = width * 0.01;
                tempCtx.shadowOffsetX = width * 0.002;
                tempCtx.shadowOffsetY = width * 0.002;

                const posX = (overlay.x / 100) * width;
                const posY = (overlay.y / 100) * height;
                
                tempCtx.fillText(overlay.text, posX, posY);
                
                pushToHistory(tempCanvas.toDataURL('image/jpeg'));
            }
            setOverlay(prev => ({ ...prev, text: '' }));
            clearInteractionCanvas();
            setHasInteraction(false);
        };
        originalImage.src = currentImage;
    };
    
    const changeMode = (newMode: EditMode) => {
        setMode(newMode);
        setShowYouTubeGuide(false);
        clearInteractionCanvas();
        cropRect.current = null;
        refinePaths.current = [];
        setHasInteraction(false);
        if (newMode !== 'text') {
            setTextEditPrompt('');
        }
    };

    const handleSaveAndClose = () => {
        if (isProcessing) return;
        // CRITICAL FIX: Always return the absolute latest entry in the history
        const finalImage = history.length > 0 ? history[history.length - 1] : currentImage;
        setIsSaved(true);
        onSave(finalImage);
        
        setTimeout(() => {
            onClose();
        }, 300);
    };
    
    const handleToggleYouTubeGuide = () => {
        if (!is16by9) return;
        changeMode('crop');
        setShowYouTubeGuide(prev => !prev);
    };

    const renderToolOptions = () => {
        const fonts = [
            { id: 'Space Grotesk', name: 'Modern Sans' },
            { id: 'Inter', name: 'UI Standard' },
            { id: 'Outfit', name: 'Clean Tech' },
            { id: 'Playfair Display', name: 'Editorial Serif' }
        ];

        const presets = [
            { name: 'Headline', size: 80, y: 50, font: 'Space Grotesk' },
            { name: 'Badge', size: 30, x: 20, y: 20, font: 'Inter' },
            { name: 'Subtitle', size: 40, y: 75, font: 'Outfit' }
        ];

        switch (mode) {
            case 'crop':
                return (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Click and drag to select crop area.</p>
                        <button onClick={applyCrop} disabled={!hasInteraction || isProcessing || showYouTubeGuide} className="w-full p-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-[10px]">Apply Crop</button>
                    </div>
                );
            case 'refine':
                return (
                    <div className="flex flex-col gap-2">
                         <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Paint over logos or unwanted items to erase them.</p>
                        <button onClick={applyRefine} disabled={!hasInteraction || isProcessing} className="w-full p-4 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-slate-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-[10px]">
                            {isProcessing ? 'Removing...' : 'Execute Erasure'}
                        </button>
                    </div>
                );
            case 'text':
                return (
                    <div className="flex flex-col gap-2">
                        <label htmlFor="text-edit-prompt" className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1">AI Instruction:</label>
                        <textarea
                            id="text-edit-prompt"
                            value={textEditPrompt}
                            onChange={(e) => setTextEditPrompt(e.target.value)}
                            placeholder="e.g., Change house color to blue"
                            className="w-full bg-white dark:bg-gray-800 border-2 border-slate-200 dark:border-gray-700 rounded-xl p-4 text-sm focus:border-orange-500 focus:outline-none transition-all resize-none h-32 font-medium"
                            rows={3}
                            disabled={isProcessing}
                        />
                        <button onClick={applyTextEdit} className="w-full p-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-[10px]" disabled={isProcessing || !textEditPrompt.trim()}>
                           {isProcessing ? 'Processing...' : 'Modify Image'}
                        </button>
                    </div>
                );
            case 'overlay':
                return (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Text Content</label>
                            <input 
                                type="text" 
                                value={overlay.text} 
                                onChange={(e) => setOverlay(prev => ({ ...prev, text: e.target.value }))}
                                className="w-full bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-3 text-sm font-bold focus:border-orange-500 outline-none"
                                placeholder="TYPE SOMETHING..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Font Style</label>
                                <select 
                                    value={overlay.font} 
                                    onChange={(e) => setOverlay(prev => ({ ...prev, font: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-2 text-xs font-bold"
                                >
                                    {fonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Color</label>
                                <div className="flex gap-1">
                                    {['#FFFFFF', '#EA580C', '#000000', '#FDE047'].map(c => (
                                        <button 
                                            key={c} 
                                            onClick={() => setOverlay(prev => ({ ...prev, color: c }))}
                                            className={`w-6 h-6 rounded-full border-2 ${overlay.color === c ? 'border-blue-500' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Size & Position</label>
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-bold w-8">SIZE</span>
                                    <input type="range" min="10" max="200" value={overlay.size} onChange={(e) => setOverlay(prev => ({ ...prev, size: parseInt(e.target.value) }))} className="flex-grow accent-orange-600" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-bold w-8">POS X</span>
                                    <input type="range" min="0" max="100" value={overlay.x} onChange={(e) => setOverlay(prev => ({ ...prev, x: parseInt(e.target.value) }))} className="flex-grow accent-orange-600" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-bold w-8">POS Y</span>
                                    <input type="range" min="0" max="100" value={overlay.y} onChange={(e) => setOverlay(prev => ({ ...prev, y: parseInt(e.target.value) }))} className="flex-grow accent-orange-600" />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {presets.map(p => (
                                <button 
                                    key={p.name}
                                    onClick={() => setOverlay(prev => ({ ...prev, ...p }))}
                                    className="px-2 py-1 bg-slate-100 dark:bg-gray-800 rounded text-[8px] font-black uppercase hover:bg-orange-100 transition-colors"
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>

                        <button onClick={applyOverlay} disabled={!overlay.text} className="w-full p-4 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-30 text-white font-black uppercase tracking-widest text-[10px]">Apply Text Overlay</button>
                    </div>
                );
            case 'strategy':
                return (
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 gap-2">
                            {SOCIAL_STRATEGIES.map(s => (
                                <button 
                                    key={s.id}
                                    onClick={() => setActiveGuide(activeGuide?.id === s.id ? null : s)}
                                    className={`p-4 rounded-xl border-2 transition-all text-left ${activeGuide?.id === s.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-slate-300'}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[11px] font-black uppercase tracking-widest">{s.name}</span>
                                        <span className="text-[9px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{s.aspectRatio}</span>
                                    </div>
                                    {activeGuide?.id === s.id && (
                                        <div className="mt-3 space-y-2">
                                            {s.tips.map((tip, i) => (
                                                <div key={i} className="flex gap-2 text-[10px] text-gray-600 dark:text-gray-400 font-bold leading-tight">
                                                    <span className="text-orange-500">▶</span> {tip}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="p-4 bg-orange-50/50 dark:bg-orange-950/10 rounded-xl border border-orange-100 dark:border-orange-900/30">
                            <p className="text-[9px] font-bold text-orange-800 dark:text-orange-300 leading-relaxed uppercase tracking-tighter">
                                Strategy Engine: <span className="text-orange-600 dark:text-orange-400 italic">Latest algorithms prioritize "Share-ability". High-contrast, emotional faces are moving the needle most on Thumbnails and Carousels.</span>
                            </p>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    }
    
    const toolButtons = [
        { id: 'crop', name: 'Crop', icon: <CropIcon /> },
        { id: 'refine', name: 'Refine (Erase Logos)', icon: <RefineIcon /> },
        { id: 'text', name: 'AI Edit', icon: <TextIcon /> },
        { id: 'overlay', name: 'Overlay Text', icon: <TextIcon /> },
        { id: 'strategy', name: 'Social Strategy', icon: <Database className="w-5 h-5 text-orange-500" /> }
    ];

    const checkerboardLight = 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)';
    const checkerboardDark = 'linear-gradient(45deg, #374151 25%, transparent 25%), linear-gradient(-45deg, #374151 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #374151 75%), linear-gradient(-45deg, transparent 75%, #374151 75%)';

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-md" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="editor-title">
            <div className="bg-slate-100 dark:bg-gray-950 border-4 border-white dark:border-gray-800 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.5)] w-full max-w-7xl h-[92vh] flex flex-col p-6 gap-6 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <header className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-gray-800 pb-6">
                     <div className="flex items-center gap-4">
                        <div className="bg-orange-600 p-2 rounded-xl">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </div>
                        <div>
                            <h2 id="editor-title" className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Vision Refiner</h2>
                            {error && <div className="text-red-500 dark:text-red-400 text-[10px] font-black uppercase mt-1" role="alert">{error}</div>}
                        </div>
                    </div>
                     <div className="flex items-center gap-3">
                         <button onClick={undo} disabled={history.length <= 1 || isProcessing} className="px-5 py-2.5 bg-slate-200 dark:bg-gray-800 hover:bg-slate-300 dark:hover:bg-gray-700 rounded-xl disabled:opacity-30 text-[10px] font-black uppercase tracking-widest transition-colors">Undo</button>
                         <button 
                            onClick={handleSaveAndClose} 
                            disabled={isProcessing} 
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-xl flex items-center gap-2
                                ${isSaved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}
                                ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
                            `}
                         >
                             {isSaved ? <><div className="w-2 h-2 bg-white rounded-full animate-ping"></div> Confirmed</> : (isProcessing ? 'Syncing...' : 'Save & Close')}
                         </button>
                         <button onClick={onClose} className="px-5 py-2.5 bg-slate-200 dark:bg-gray-800 hover:bg-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Cancel</button>
                     </div>
                </header>
                
                <div className="flex-grow flex gap-6 min-h-0">
                    <aside className="w-72 flex-shrink-0 flex flex-col bg-white dark:bg-gray-900 p-5 rounded-3xl border border-slate-200 dark:border-gray-800 shadow-inner">
                        <div className="flex flex-col gap-3">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Tools</h3>
                             {toolButtons.map(tool => (
                                <button
                                    key={tool.id}
                                    onClick={() => changeMode(tool.id as EditMode)}
                                    className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 transition-all ${
                                        mode === tool.id && !showYouTubeGuide
                                        ? 'bg-orange-600 text-white shadow-lg scale-[1.02]'
                                        : 'bg-slate-50 dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    <span className={mode === tool.id ? 'text-white' : 'text-orange-500'}>{tool.icon}</span>
                                    <span className="font-black text-[10px] uppercase tracking-widest">{tool.name}</span>
                                </button>
                            ))}
                        </div>
                        <div className="border-t border-slate-100 dark:border-gray-800 my-6"></div>
                        <div className="flex-grow">
                            {renderToolOptions()}
                        </div>
                         {showYouTubeGuide && (
                            <div className="mt-2 p-4 bg-sky-100 dark:bg-sky-900/30 rounded-2xl text-[10px] text-sky-800 dark:text-sky-300 font-bold leading-relaxed border border-sky-200 dark:border-sky-800">
                                <p><strong>Safe Zone Active:</strong> Ensure key visual information is centered within the dashed border.</p>
                            </div>
                        )}
                        <div className="border-t border-slate-100 dark:border-gray-800 my-6"></div>
                         <div>
                             <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Guides</h3>
                             <button
                                onClick={handleToggleYouTubeGuide}
                                disabled={!is16by9}
                                className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 transition-all ${
                                    showYouTubeGuide
                                    ? 'bg-sky-600 text-white shadow-lg scale-[1.02]'
                                    : 'bg-slate-50 dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                } ${!is16by9 ? 'opacity-30 cursor-not-allowed' : ''}`}
                            >
                                <YouTubeIcon />
                                <span className="font-black text-[10px] uppercase tracking-widest">YouTube Safe Zone</span>
                            </button>
                         </div>
                    </aside>
                    <main
                        ref={mainContainerRef}
                        className="flex-grow bg-slate-200 dark:bg-black rounded-3xl flex items-center justify-center relative min-w-0 p-8 overflow-hidden shadow-inner border border-slate-200 dark:border-gray-800"
                         style={{
                            backgroundImage: theme === 'light' ? checkerboardLight : checkerboardDark,
                            backgroundSize: '30px 30px',
                            backgroundPosition: '0 0, 0 15px, 15px -15px, -15px 0px'
                        }}
                    >
                        {isProcessing && (
                            <div className="absolute inset-0 z-40 bg-black/40 flex items-center justify-center backdrop-blur-sm transition-all duration-300">
                                <div className="flex flex-col items-center">
                                     <div className="w-16 h-16 border-4 border-white border-t-orange-600 rounded-full animate-spin mb-4"></div>
                                     <p className="text-white font-black uppercase tracking-widest text-xs">AI Refining Image...</p>
                                </div>
                            </div>
                        )}
                        <div className="relative shadow-[0_40px_100px_rgba(0,0,0,0.5)] bg-black rounded-xl overflow-hidden">
                            <canvas ref={canvasRef} className="block max-w-full max-h-[75vh] object-contain" />
                            <canvas 
                                ref={interactionCanvasRef} 
                                className={`absolute top-0 left-0 w-full h-full ${!showYouTubeGuide ? 'cursor-crosshair' : 'cursor-default'}`}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                            />
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default ImageEditor;
