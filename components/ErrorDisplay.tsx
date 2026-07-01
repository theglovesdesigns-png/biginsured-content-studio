
import React from 'react';

interface ErrorDisplayProps {
    message: string;
    onRetry: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, onRetry }) => {
    const parts = message.split('ACTION:');
    const mainMessage = parts[0].trim();
    const actionMessage = parts[1]?.trim();

    return (
        <div className="bg-white dark:bg-gray-950 border-2 border-red-500/30 dark:border-red-500/20 p-8 rounded-[2rem] shadow-2xl animate-shake relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-red-600"></div>
            <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-950/30 text-red-600 rounded-2xl flex items-center justify-center text-3xl font-black flex-shrink-0">
                    !
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h4 className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em] mb-2">Generation Interrupted</h4>
                    <p className="text-lg font-black text-slate-900 dark:text-white leading-tight mb-3">{mainMessage}</p>
                    
                    {actionMessage && (
                        <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-900/50 inline-block text-left">
                            <span className="text-[9px] font-black text-red-600 uppercase tracking-widest block mb-1">Recommended Action</span>
                            <p className="text-xs font-bold text-red-900 dark:text-red-200">{actionMessage}</p>
                        </div>
                    )}
                </div>
                <button
                    onClick={onRetry}
                    className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs tracking-widest py-5 px-10 rounded-2xl transition-all shadow-lg hover:shadow-red-600/20 active:scale-95 border-2 border-white"
                >
                    Retry Generation
                </button>
            </div>
        </div>
    );
};

export default ErrorDisplay;