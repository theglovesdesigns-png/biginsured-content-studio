
import React from 'react';

interface PromptSnippetsProps {
    selectedSnippets: string[];
    onSnippetToggle: (snippet: string) => void;
}

const snippetCategories = [
    {
        name: 'Style',
        snippets: [
            'Cinematic', 'Hyperrealistic', '3D Render', 'Minimalist', 'Watercolor', 
            'Architectural Visualization', 'Editorial Photography', 'Dark Moody Realism', 
            'Flat Design Illustration', 'Retro Analog Film'
        ]
    },
    {
        name: 'Camera Angle',
        snippets: [
            'Centered Full View', 'Safe Margins', 'Wide Field of Vision', 'Panorama', 
            'Deep Depth of Field', 'Symmetrical', 'Dynamic angle', 'Aerial Drone'
        ]
    },
    {
        name: 'Quality',
        snippets: [
            'Sharp focus', 'Intricate detail', 'UHD', 'Photorealistic rendering', 
            'Professional color grading', 'Studio-quality output'
        ]
    },
    {
        name: 'Lighting',
        snippets: [
            'Golden hour', 'Studio lighting', 'Volumetric lighting', 
            'Rembrandt lighting', 'Neon urban night lighting', 'Soft diffused natural light'
        ]
    }
];

const SnippetButton: React.FC<{ text: string; isActive: boolean; onClick: () => void }> = ({ text, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-2 text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all duration-300 border-2 ${
                isActive 
                ? 'bg-orange-600 border-white text-white scale-105 shadow-[0_10px_20px_rgba(234,88,12,0.2)]' 
                : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:border-orange-500/50 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
            {text}
        </button>
    );
};

const PromptSnippets: React.FC<PromptSnippetsProps> = ({ selectedSnippets, onSnippetToggle }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {snippetCategories.map(category => (
                <div key={category.name} className="flex flex-col gap-4">
                    <h4 className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.3em] ml-1">
                        {category.name} Engine
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {category.snippets.map(snippet => (
                            <SnippetButton 
                                key={snippet} 
                                text={snippet} 
                                onClick={() => onSnippetToggle(snippet)}
                                isActive={selectedSnippets.includes(snippet)}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PromptSnippets;
