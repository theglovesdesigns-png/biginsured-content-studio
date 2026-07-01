
import React, { useState } from 'react';
import { AspectRatio } from '../types';
import { saveImageFeedback } from '../services/feedbackService';
import { convertBlobToJpg } from '../services/imageUtils';

interface GeneratedResult {
    id: string;
    src: string;
    prompt: string;
    negativePrompt: string;
    aspectRatio: AspectRatio;
}

interface GeneratedImageProps {
    image: GeneratedResult;
    onEdit: () => void;
    onAddToUploadQueue: () => void;
    onGenerateVariation: () => void;
    onSaveToGallery: () => Promise<boolean>;
}

const GeneratedImage: React.FC<GeneratedImageProps> = ({ image, onEdit, onAddToUploadQueue, onGenerateVariation, onSaveToGallery }) => {
    const { src, prompt, aspectRatio, negativePrompt } = image;
    const [resolution, setResolution] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [feedbackStatus, setFeedbackStatus] = useState<'up' | 'down' | null>(null);
    
    const handleFeedback = async (type: 'up' | 'down') => {
        await saveImageFeedback({
            prompt,
            negative_prompt: negativePrompt,
            aspect_ratio: aspectRatio,
            feedback: type
        });
        setFeedbackStatus(type);
    };
    
    const handleDownload = async () => {
        try {
            const generateFilename = () => {
                // 1. Extract keywords from the prompt
                const keywords = prompt
                    .toLowerCase()
                    .replace(/[^a-z0-9\s]/gi, '') // remove special chars
                    .split(' ')
                    .filter(word => word.length > 3 && !['with', 'the', 'and', 'for', 'photo', 'image', 'style', 'cinematic', 'lighting'].includes(word)) // filter short/common words
                    .slice(0, 4) // take up to 4 keywords
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize
                    .join('_');

                const safeKeywords = keywords || 'Generated_Image';

                // 2. Format aspect ratio/Preset Name
                let ratioLabel = aspectRatio.replace(':', 'x');
                
                // Map preset IDs to user-friendly file parts
                switch(aspectRatio) {
                    // Website
                    case '1600x533': ratioLabel = 'Service-Section_1600x533'; break;
                    case '1920x600': ratioLabel = 'Blog-Hero_1920x600'; break;
                    case '1920x1080': ratioLabel = 'Flexible_1920x1080'; break;
                    
                    // Social Essential
                    case '1080x1080': ratioLabel = 'instagram-post-square'; break;
                    case '1080x1920': ratioLabel = 'stories-reels-vertical'; break;
                    case '1200x630': ratioLabel = 'facebook-post'; break;
                    case '1200x675': ratioLabel = 'x-post'; break;
                    case '1200x900': ratioLabel = 'google-business-post'; break;
                    
                    // Social Optional
                    case '1080x1350': ratioLabel = 'instagram-post-portrait'; break;
                    case '1280x720': ratioLabel = 'youtube-thumbnail'; break;
                    case '1500x500': ratioLabel = 'x-header'; break;
                    case '1024x576': ratioLabel = 'google-business-cover'; break;
                }

                // 3. Format date DDMMYYYY
                const today = new Date();
                const day = String(today.getDate()).padStart(2, '0');
                const month = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
                const year = today.getFullYear();
                const formattedDate = `${day}${month}${year}`;
                
                return `${safeKeywords}_[${ratioLabel}]_${formattedDate}.jpg`;
            };

            const response = await fetch(src);
            const rawBlob = await response.blob();
            const jpgBlob = await convertBlobToJpg(rawBlob, 0.90);
            const url = window.URL.createObjectURL(jpgBlob);

            const link = document.createElement('a');
            link.href = url;
            link.download = generateFilename();
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading generated image:', error);
            // Fallback dynamic download from source
            const link = document.createElement('a');
            link.href = src;
            link.download = 'generated-image.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    
    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            await onSaveToGallery();
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (error) {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="relative group w-full">
            <img 
                src={src} 
                alt={prompt} 
                className="rounded-lg shadow-2xl w-full h-auto object-contain transition-opacity duration-500 ease-in-out opacity-0 bg-slate-200 dark:bg-black"
                onLoad={(e) => {
                    e.currentTarget.style.opacity = '1';
                    setResolution(`${e.currentTarget.naturalWidth} x ${e.currentTarget.naturalHeight} px`);
                }}
            />
             <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm font-mono select-none">
                {aspectRatio}
            </div>
             {resolution && (
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm font-mono select-none">
                    {resolution}
                </div>
             )}
             
             {/* Save Status Notification */}
             {saveStatus === 'success' && (
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-600/90 text-white px-4 py-2 rounded-lg font-bold backdrop-blur-sm animate-fade-in shadow-xl z-20">
                     Saved to Gallery!
                 </div>
             )}
             
             <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col sm:flex-row gap-2">
                 {/* Feedback Buttons */}
                 <div className="flex gap-1 bg-black/40 backdrop-blur-md p-1 rounded-lg border border-white/10">
                     <button
                       onClick={() => handleFeedback('up')}
                       title="I like this style"
                       className={`p-1.5 rounded-md transition-all ${feedbackStatus === 'up' ? 'bg-green-500 text-white scale-110' : 'text-white/70 hover:text-green-400 hover:bg-white/10'}`}
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                             <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 10.133a1.5 1.5 0 01-.8.2z" />
                         </svg>
                     </button>
                     <button
                       onClick={() => handleFeedback('down')}
                       title="I don't like this"
                       className={`p-1.5 rounded-md transition-all ${feedbackStatus === 'down' ? 'bg-red-500 text-white scale-110' : 'text-white/70 hover:text-red-400 hover:bg-white/10'}`}
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                             <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.867a1.5 1.5 0 01.8-.2z" />
                         </svg>
                     </button>
                 </div>

                 <button
                    onClick={onAddToUploadQueue}
                    title="Add to Upload Queue (Files)"
                    className="bg-orange-600/80 hover:bg-orange-700 text-white font-bold px-3 py-2 rounded-lg backdrop-blur-sm flex items-center gap-2 text-sm"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.414l-1.293 1.293a1 1 0 01-1.414-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L13 9.414V13h-2.5z" />
                    </svg>
                 </button>
                 
                 <button
                    onClick={handleSave}
                    disabled={isSaving}
                    title="Save to Gallery (Database)"
                    className={`font-bold p-2 rounded-lg backdrop-blur-sm flex items-center gap-2 ${
                        saveStatus === 'error' 
                        ? 'bg-red-600/80 text-white' 
                        : 'bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-700 text-gray-800 dark:text-white'
                    }`}
                >
                    {isSaving ? (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                             <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                        </svg>
                    )}
                </button>

                  <button
                    onClick={onGenerateVariation}
                    title="Generate Variations"
                    className="bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold p-2 rounded-lg backdrop-blur-sm flex items-center gap-2"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0V6h-1a1 1 0 110-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                </button>
                 <button
                    onClick={onEdit}
                    title="Edit Image"
                    className="bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold p-2 rounded-lg backdrop-blur-sm flex items-center gap-2"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                    </svg>
                </button>
                <button
                    onClick={handleDownload}
                    title="Download Image"
                    className="bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold p-2 rounded-lg backdrop-blur-sm flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
             </div>
        </div>
    );
};

export default GeneratedImage;
