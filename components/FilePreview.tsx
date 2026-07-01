
import React from 'react';
import { ManagedFile } from '../types';

interface FilePreviewProps {
    managedFile: ManagedFile;
    onRemove: (id: string) => void;
    onUpdateFile: (id: string, updates: Partial<ManagedFile>) => void;
}

const StatusOverlay: React.FC<{ managedFile: ManagedFile }> = ({ managedFile }) => {
    const { status, error, publicUrl } = managedFile;
    if (status === 'queued') return null;
    
    // Always show a success checkmark
    if (status === 'success') {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/80 backdrop-blur-sm p-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white mb-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {publicUrl && (
                    <a 
                        href={publicUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] font-black text-white uppercase tracking-widest bg-black/20 px-3 py-1.5 rounded-full hover:bg-black/40 transition-all border border-white/30"
                    >
                        View File
                    </a>
                )}
            </div>
        )
    }


    let content;
    let overlayClass = "bg-black/60 backdrop-blur-sm text-white"; // Default overlay

    switch (status) {
        case 'resizing':
        case 'uploading':
            content = (
                <>
                    <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs font-semibold mt-1 capitalize">{status}...</span>
                </>
            );
            break;
        case 'error':
             overlayClass = "bg-red-100/80 dark:bg-red-900/80 backdrop-blur-sm border-2 border-red-400 dark:border-red-500";
            content = (
                <div className="flex flex-col items-center justify-center text-center p-2 overflow-hidden">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-bold mt-1 text-red-700 dark:text-red-300">Upload Failed</span>
                    <p className="text-xs text-red-600 dark:text-red-200 mt-1 px-1 truncate" title={error}>
                        {error || 'An unknown error occurred.'}
                    </p>
                </div>
            );
            break;
    }
    
    return (
        <div className={`absolute inset-0 flex flex-col items-center justify-center text-center p-1 ${overlayClass}`}>
            {content}
        </div>
    );
};


const FilePreview: React.FC<FilePreviewProps> = ({ managedFile, onRemove }) => {
    const { id, file, previewUrl, status, error } = managedFile;

    const isProcessing = ['uploading', 'resizing'].includes(status);
    const showRemoveButton = !isProcessing && status !== 'success';

    return (
        <div className="bg-slate-100 dark:bg-gray-900 rounded-lg overflow-hidden border border-slate-200 dark:border-gray-700 flex flex-col shadow group">
            <div className="relative w-full aspect-square">
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt={file.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200 dark:bg-gray-800 p-2 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 dark:text-gray-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <p className="text-xs text-gray-500 dark:text-gray-500">No Preview</p>
                    </div>
                )}
                
                {showRemoveButton && (
                     <div className="absolute inset-0 bg-black bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                            onClick={() => onRemove(id)}
                            className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg"
                            aria-label={`Remove ${file.name}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}
                <StatusOverlay managedFile={managedFile} />
            </div>
        </div>
    );
};

export default FilePreview;
