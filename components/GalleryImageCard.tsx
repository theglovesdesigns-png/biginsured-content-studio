
import React, { useState, useEffect, useRef } from 'react';
import { GalleryImage } from '../types';
import { convertBlobToJpg } from '../services/imageUtils';

// Icon Components
const DotsVerticalIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>;
const ShareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;
const CopyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.414l-1.293 1.293a1 1 0 01-1.414-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L13 9.414V13h-2.5z" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

interface GalleryImageCardProps {
    image: GalleryImage;
    isSelected?: boolean;
    onToggleSelect?: (id: number) => void;
    onDelete: (id: number, imageUrl: string) => void;
    onAddToUploadQueue: (image: { url: string, name: string }) => void;
}

const GalleryImageCard: React.FC<GalleryImageCardProps> = ({ 
    image, 
    isSelected = false,
    onToggleSelect,
    onDelete, 
    onAddToUploadQueue 
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [copySuccess, setCopySuccess] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    const imageUrl = image.image_url ?? '';
    const filename = imageUrl.split('/').pop() ?? 'gallery-image.jpg';

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef]);
    
    useEffect(() => {
        if(copySuccess) {
            const timer = setTimeout(() => setCopySuccess(''), 2000);
            return () => clearTimeout(timer);
        }
    }, [copySuccess]);

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: `Image: ${filename}`, text: `Check out this image.`, url: imageUrl });
            } catch (error) { console.error('Error sharing:', error); }
        } else {
            navigator.clipboard.writeText(imageUrl);
            setCopySuccess('Link Copied!');
        }
        setIsMenuOpen(false);
    };

    const handleDownload = async () => {
        try {
            const response = await fetch(imageUrl);
            const rawBlob = await response.blob();
            
            // Convert to high-quality JPG regardless of source format (WebP/PNG etc.)
            const jpgBlob = await convertBlobToJpg(rawBlob, 0.90);
            const url = window.URL.createObjectURL(jpgBlob);
            
            const downloadFilename = filename.toLowerCase().endsWith('.jpg') 
                ? filename 
                : filename.replace(/\.[^/.]+$/, "") + ".jpg";
                
            const link = document.createElement('a');
            link.href = url;
            link.download = downloadFilename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading image:', error);
            window.open(imageUrl, '_blank');
        }
        setIsMenuOpen(false);
    };

    const handleCopyPrompt = () => {
        if (image.prompt) {
            navigator.clipboard.writeText(image.prompt);
            setCopySuccess('Prompt Copied!');
        }
        setIsMenuOpen(false);
    };

    const handleAddToUploader = () => {
        onAddToUploadQueue({ url: imageUrl, name: filename });
        setIsMenuOpen(false);
    };

    const handleDelete = () => {
        if (window.confirm("Are you sure you want to permanently delete this image?")) {
            onDelete(image.id, imageUrl);
        }
        setIsMenuOpen(false);
    };

    return (
        <div 
            className={`group relative aspect-w-1 aspect-h-1 bg-slate-200 dark:bg-gray-900 rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 border-2
                ${isSelected ? 'border-orange-500 ring-4 ring-orange-500/10 scale-[0.98]' : 'border-transparent hover:-translate-y-1'}
            `}
            onClick={(e) => {
                if (onToggleSelect) {
                    onToggleSelect(image.id);
                }
            }}
        >
            <img src={imageUrl} alt={image.prompt ?? 'Generated image'} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            
            {/* Aspect Ratio Badge */}
            {image.aspect_ratio && (
                <div className="absolute top-2 right-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-md border border-white/20">
                        {image.aspect_ratio}
                    </span>
                </div>
            )}

            {/* Selection Checkbox */}
            <div className={`absolute top-2 left-2 transition-all duration-300 ${isSelected || 'opacity-0 group-hover:opacity-100'}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                    ${isSelected ? 'bg-orange-500 border-white' : 'bg-black/40 border-white/60 backdrop-blur-sm'}
                `}>
                    {isSelected && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    )}
                </div>
            </div>

            {/* Hover Overlay with Details */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-all duration-300 flex flex-col justify-end p-3 
                ${isSelected ? 'opacity-100 bg-orange-950/20' : 'opacity-0 group-hover:opacity-100'}
            `}>
                <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest font-display">Prompt</span>
                        {image.aspect_ratio && (
                            <span className="text-[10px] font-medium text-white/60 ml-auto">{image.aspect_ratio}</span>
                        )}
                    </div>
                    <p className="text-white text-[11px] leading-relaxed font-medium line-clamp-2 mb-2" title={image.prompt ?? ''}>
                        {image.prompt}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                         <span className="text-[9px] text-white/40 font-mono">
                            {new Date(image.created_at).toLocaleDateString()}
                         </span>
                    </div>
                </div>
            </div>
            
            {copySuccess && <div className="absolute top-2 left-10 bg-green-600/80 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm select-none z-10">{copySuccess}</div>}

            <div ref={menuRef} className="absolute top-2 right-2" onClick={e => e.stopPropagation()}>
                <button
                    onClick={() => setIsMenuOpen(prev => !prev)}
                    className="p-1.5 bg-black/40 rounded-md text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm focus:outline-none"
                    aria-label="Image options"
                >
                    <DotsVerticalIcon />
                </button>

                {isMenuOpen && (
                    <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-md shadow-2xl z-20 py-1">
                        <button onClick={handleCopyPrompt} className="w-full flex items-center px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-50" disabled={!image.prompt}><CopyIcon /> Copy Prompt</button>
                        <button onClick={handleAddToUploader} className="w-full flex items-center px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700"><UploadIcon /> Add to Uploader</button>
                        <div className="my-1 border-t border-slate-200 dark:border-gray-700"></div>
                        <button onClick={handleShare} className="w-full flex items-center px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700"><ShareIcon /> Share Link</button>
                        <button onClick={handleDownload} className="w-full flex items-center px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700"><DownloadIcon /> Download</button>
                        <div className="my-1 border-t border-slate-200 dark:border-gray-700"></div>
                        <button onClick={handleDelete} className="w-full flex items-center px-3 py-1.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"><TrashIcon /> Delete</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GalleryImageCard;
