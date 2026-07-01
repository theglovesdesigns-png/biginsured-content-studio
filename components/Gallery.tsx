
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchGalleryImages, deleteGalleryImage } from '../services/galleryService';
import { GalleryImage } from '../types';
import LoadingSpinner from './LoadingSpinner';
import GalleryImageCard from './GalleryImageCard';
import JSZip from 'jszip';

interface GalleryProps {
    onAddToUploadQueue: (image: { url:string, name: string }) => void;
}

const GALLERY_PAGE_LIMIT = 15;

const Gallery: React.FC<GalleryProps> = ({ onAddToUploadQueue }) => {
    const [images, setImages] = useState<GalleryImage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const observer = useRef<IntersectionObserver | null>(null);

    const loadImages = useCallback(async (pageNum: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const newImages = await fetchGalleryImages(pageNum, GALLERY_PAGE_LIMIT);
            if (newImages.length === 0) {
                setHasMore(false);
            } else {
                setImages((prev) => {
                    const existingIds = new Set(prev.map((img) => img.id));
                    const uniqueNewImages = newImages.filter((img) => !existingIds.has(img.id));
                    return [...prev, ...uniqueNewImages];
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load gallery.");
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    useEffect(() => {
        loadImages(1);
    }, [loadImages]);

    const lastImageElementRef = useCallback((node: HTMLDivElement | null) => {
        if (isLoading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore) {
                setPage((prevPage) => prevPage + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [isLoading, hasMore]);

    useEffect(() => {
        if (page > 1) {
            loadImages(page);
        }
    }, [page, loadImages]);
    
     const handleDelete = useCallback(async (id: number, imageUrl: string) => {
        try {
            await deleteGalleryImage(id, imageUrl);
            setImages((prev) => prev.filter((image) => image.id !== id));
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to delete image.");
        }
    }, []);

    const toggleSelect = useCallback((id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const selectAll = () => {
        const allIds = images.map(img => img.id);
        setSelectedIds(new Set(allIds));
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    const handleDownloadZip = async () => {
        if (selectedIds.size === 0) return;
        setIsExporting(true);
        try {
            const zip = new JSZip();
            const selectedImages = images.filter(img => selectedIds.has(img.id));
            
            const fetchPromises = selectedImages.map(async (img) => {
                const url = img.image_url;
                if (!url) return;
                
                const response = await fetch(url);
                const blob = await response.blob();
                
                // Get preset-friendly label if exists
                let presetLabel = (img.aspect_ratio || 'generic').replace(':', 'x');
                if (img.aspect_ratio === '1920x600') presetLabel = 'blog-hero';
                if (img.aspect_ratio === '1600x533') presetLabel = 'service-banner';
                
                const cleanPrompt = (img.prompt || 'vision')
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .substring(0, 30);
                const extension = url.split('.').pop()?.split('?')[0] || 'jpg';
                const filename = `${cleanPrompt}_[${presetLabel}].${extension}`;
                
                zip.file(filename, blob);
            });

            await Promise.all(fetchPromises);
            
            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `BIGINSURED-BATCH-EXPORT-${new Date().getTime()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            
            deselectAll();
        } catch (err) {
            alert("Error generating ZIP: " + (err instanceof Error ? err.message : "Unknown error"));
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} images?`)) return;

        const idsToDelete = Array.from(selectedIds);
        for (const id of idsToDelete) {
            const img = images.find(i => i.id === id);
            if (img && img.image_url) {
                await handleDelete(id, img.image_url);
            }
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto pb-20">
            {/* Selection Action Bar */}
            {selectedIds.size > 0 && (
                <div className="sticky top-20 z-40 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border border-slate-200 dark:border-gray-800 p-4 mb-8 rounded-2xl shadow-xl flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest font-display">Selected Items</span>
                            <span className="text-xl font-bold dark:text-white leading-none font-display">{selectedIds.size} Images</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={selectAll} className="text-[10px] font-bold uppercase text-gray-500 hover:text-orange-600 transition-colors">Select Page</button>
                            <button onClick={deselectAll} className="text-[10px] font-bold uppercase text-gray-500 hover:text-orange-600 transition-colors">Clear</button>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={handleDeleteSelected}
                            className="px-6 py-3 bg-red-50 dark:bg-red-950/30 text-red-600 hover:bg-red-600 hover:text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all border border-red-200 dark:border-red-900/50 font-display"
                        >
                            Delete Selected
                        </button>
                        <button 
                            onClick={handleDownloadZip}
                            disabled={isExporting}
                            className="px-6 py-3 bg-orange-600 text-white hover:bg-orange-700 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all shadow-xl border-2 border-white flex items-center gap-2 font-display"
                        >
                            {isExporting ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Syncing Bundle...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Export Sized Archive (ZIP)
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {images.length > 0 && (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {images.map((image, index) => {
                         const isSelected = selectedIds.has(image.id);
                         if (images.length === index + 1) {
                             return (
                                <div ref={lastImageElementRef} key={image.id}>
                                    <GalleryImageCard 
                                        image={image} 
                                        isSelected={isSelected}
                                        onToggleSelect={toggleSelect}
                                        onDelete={handleDelete} 
                                        onAddToUploadQueue={onAddToUploadQueue} 
                                    />
                                </div>
                             )
                         } else {
                              return (
                                <GalleryImageCard 
                                    key={image.id} 
                                    image={image} 
                                    isSelected={isSelected}
                                    onToggleSelect={toggleSelect}
                                    onDelete={handleDelete} 
                                    onAddToUploadQueue={onAddToUploadQueue} 
                                />
                              );
                         }
                    })}
                </div>
            )}

            {isLoading && (
                <div className="flex justify-center my-8">
                    <LoadingSpinner />
                </div>
            )}
            
            {error && !isLoading && (
                <div className="text-center my-8 p-4 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 rounded-lg">
                    <p className="text-red-700 dark:text-red-300 font-semibold">Error loading gallery:</p>
                    <p className="text-red-500 dark:text-red-400">{error}</p>
                </div>
            )}
            
            {!isLoading && !hasMore && images.length === 0 && (
                <div className="text-center my-8 p-8 bg-slate-100 dark:bg-gray-900/50 rounded-lg">
                    <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">Your Gallery is Empty</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Generated images will appear here.</p>
                </div>
            )}
        </div>
    );
};

export default Gallery;
