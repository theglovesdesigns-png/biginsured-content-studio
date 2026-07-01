
import React, { useRef } from 'react';

interface RichPromptEditorProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    onDragOver?: (e: React.DragEvent<HTMLTextAreaElement>) => void;
    onDrop?: (e: React.DragEvent<HTMLTextAreaElement>) => void;
}

const RichPromptEditor: React.FC<RichPromptEditorProps> = ({ 
    value, 
    onChange, 
    placeholder,
    onDragOver,
    onDrop 
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
    };

    return (
        <div className="relative w-full">
            <div className="relative w-full h-56 rounded-3xl overflow-hidden border-2 border-slate-200 dark:border-gray-800 focus-within:border-orange-500 focus-within:ring-8 focus-within:ring-orange-500/5 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] bg-slate-50 dark:bg-gray-900/90 group">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={handleInputChange}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    placeholder={placeholder}
                    spellCheck={false}
                    className="w-full h-full bg-transparent outline-none resize-none p-6 text-lg leading-relaxed
                               text-slate-900 dark:text-slate-100 
                               placeholder:text-slate-400 dark:placeholder:text-slate-700 
                               caret-orange-600 dark:caret-orange-500
                               selection:bg-orange-500/20"
                />

                {/* Character Counter & Status */}
                <div className="absolute bottom-4 right-6 flex items-center gap-3 pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        {value.length} / 1000
                    </span>
                </div>
            </div>
        </div>
    );
};

export default RichPromptEditor;
