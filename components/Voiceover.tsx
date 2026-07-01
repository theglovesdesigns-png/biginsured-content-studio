import React, { useState, useRef, useEffect } from 'react';
import { Mic, Play, Pause, Download, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { generateVoiceover } from '../services/geminiService';
import { getSupabaseClient } from '../services/supabaseClient';
import { SUPABASE_CONFIG } from '../services/config';

const Voiceover: React.FC = () => {
    const [script, setScript] = useState('');
    const [style, setStyle] = useState('Professional');
    const [selectedVoice, setSelectedVoice] = useState('emma');
    const [targetMinutes, setTargetMinutes] = useState('0');
    const [targetSeconds, setTargetSeconds] = useState('30');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const voiceStyles = [
        { label: 'Professional', description: 'For insurance explanations' },
        { label: 'Friendly', description: 'For tips and advice' },
        { label: 'Energetic', description: 'For promotional content' },
        { label: 'Calm', description: 'For step-by-step guides' }
    ];

    const voices = [
        { id: 'emma', name: 'Emma', gender: 'Female', description: 'Professional & Clear' },
        { id: 'lily', name: 'Lily', gender: 'Female', description: 'Friendly & Warm' },
        { id: 'james', name: 'James', gender: 'Male', description: 'Deep & Authoritative' },
        { id: 'beau', name: 'Beau', gender: 'Male', description: 'Southern & Folksy' },
        { id: 'caleb', name: 'Caleb', gender: 'Male', description: 'Energetic & Bright' }
    ];

    const handleGenerate = async () => {
        if (!script.trim()) {
            setError("Please enter a script first.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setUploadSuccess(false);
        setAudioUrl(null);
        setAudioBlob(null);

        try {
            const durationStr = (parseInt(targetMinutes) > 0 || parseInt(targetSeconds) > 0) 
                ? `${targetMinutes}m ${targetSeconds}s` 
                : undefined;
                
            const base64Audio = await generateVoiceover(script, style, selectedVoice, durationStr);
            const byteCharacters = atob(base64Audio);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            
            // Gemini TTS returns raw PCM (16-bit, 24kHz, mono)
            // We must add a WAV header for the browser to play it
            const sampleRate = 24000;
            const wavHeader = new ArrayBuffer(44);
            const view = new DataView(wavHeader);

            // RIFF identifier
            view.setUint32(0, 0x52494646, false); // "RIFF"
            // file length
            view.setUint32(4, 36 + byteArray.length, true);
            // RIFF type
            view.setUint32(8, 0x57415645, false); // "WAVE"
            // format chunk identifier
            view.setUint32(12, 0x666d7420, false); // "fmt "
            // format chunk length
            view.setUint32(16, 16, true);
            // sample format (raw)
            view.setUint16(20, 1, true); // PCM
            // channel count
            view.setUint16(22, 1, true); // Mono
            // sample rate
            view.setUint32(24, sampleRate, true);
            // byte rate (sample rate * block align)
            view.setUint32(28, sampleRate * 2, true);
            // block align (channel count * bytes per sample)
            view.setUint16(32, 2, true);
            // bits per sample
            view.setUint16(34, 16, true);
            // data chunk identifier
            view.setUint32(36, 0x64617461, false); // "data"
            // data chunk length
            view.setUint32(40, byteArray.length, true);

            const wavData = new Uint8Array(44 + byteArray.length);
            wavData.set(new Uint8Array(wavHeader), 0);
            wavData.set(byteArray, 44);

            const blob = new Blob([wavData], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            
            setAudioBlob(blob);
            setAudioUrl(url);
        } catch (err) {
            console.error("TTS Generation Error:", err instanceof Error ? err.message : err);
            setError(err instanceof Error ? err.message : "Failed to generate voiceover.");
        } finally {
            setIsGenerating(false);
        }
    };

    // Cleanup object URL and reload audio
    useEffect(() => {
        if (audioUrl && audioRef.current) {
            audioRef.current.load();
        }
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    const handleDownload = () => {
        if (!audioUrl) return;
        const link = document.createElement('a');
        link.href = audioUrl;
        link.download = `voiceover_${Date.now()}.wav`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleUpload = async () => {
        if (!audioBlob) return;
        
        setIsUploading(true);
        setError(null);
        
        try {
            const supabase = getSupabaseClient();
            const timestamp = Date.now();
            const fileName = `voiceover_${timestamp}.wav`;
            const filePath = `voiceovers/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
                .from(SUPABASE_CONFIG.IMAGES_BUCKET)
                .upload(filePath, audioBlob, {
                    contentType: 'audio/wav',
                    upsert: true
                });

            if (uploadError) throw uploadError;
            setUploadSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to upload to Supabase.");
        } finally {
            setIsUploading(false);
        }
    };

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    return (
        <div className="w-full max-w-4xl mx-auto animate-fade-in pb-20">
            <div className="bg-slate-100 dark:bg-gray-950 border border-slate-200 dark:border-gray-900 p-8 md:p-12 rounded-[3rem] shadow-2xl">
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-orange-600 p-3 rounded-2xl shadow-lg text-white">
                        <Mic size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold dark:text-white font-display uppercase tracking-tight">Voiceover Studio</h2>
                        <p className="text-xs text-slate-500 dark:text-gray-400 font-bold uppercase tracking-widest">Convert scripts to professional audio</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Script Input */}
                    <div>
                        <label className="block text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-2 ml-1">Script Content</label>
                        <textarea
                            value={script}
                            onChange={(e) => setScript(e.target.value)}
                            placeholder="Paste your insurance explanation or promotional script here..."
                            className="w-full h-48 p-6 bg-white dark:bg-gray-900 border-2 border-slate-200 dark:border-gray-800 rounded-[2rem] text-slate-800 dark:text-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none resize-none font-sans text-sm leading-relaxed"
                        />
                    </div>

                    {/* Style & Gender Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-2 ml-1">Voice Style</label>
                            <div className="relative">
                                <select
                                    value={style}
                                    onChange={(e) => setStyle(e.target.value)}
                                    className="w-full p-4 bg-white dark:bg-gray-900 border-2 border-slate-200 dark:border-gray-800 rounded-2xl text-slate-800 dark:text-white focus:border-orange-500 outline-none appearance-none font-bold text-sm cursor-pointer"
                                >
                                    {voiceStyles.map((s) => (
                                        <option key={s.label} value={s.label}>{s.label}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-2 ml-1">Voice Persona</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {voices.map((v) => (
                                    <button
                                        key={v.id}
                                        onClick={() => setSelectedVoice(v.id)}
                                        className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all border-2 ${
                                            selectedVoice === v.id 
                                                ? 'bg-orange-600 text-white border-orange-600 shadow-lg' 
                                                : 'bg-white dark:bg-gray-900 text-slate-600 dark:text-gray-400 border-slate-200 dark:border-gray-800 hover:border-orange-500/50'
                                        }`}
                                    >
                                        <span className="font-black text-xs uppercase tracking-tighter">{v.name}</span>
                                        <span className={`text-[8px] uppercase tracking-widest ${selectedVoice === v.id ? 'text-orange-100' : 'text-slate-400'}`}>{v.gender}</span>
                                        <span className={`text-[7px] mt-1 font-medium text-center leading-tight ${selectedVoice === v.id ? 'text-orange-200' : 'text-slate-500'}`}>{v.description}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Target Duration */}
                    <div>
                        <label className="block text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-2 ml-1">Target Duration (Optional)</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 bg-white dark:bg-gray-900 border-2 border-slate-200 dark:border-gray-800 rounded-2xl px-4 py-1">
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={targetMinutes}
                                    onChange={(e) => setTargetMinutes(e.target.value)}
                                    className="w-full bg-transparent text-slate-800 dark:text-white font-bold text-center outline-none py-3"
                                />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Min</span>
                            </div>
                            <div className="flex items-center gap-3 bg-white dark:bg-gray-900 border-2 border-slate-200 dark:border-gray-800 rounded-2xl px-4 py-1">
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={targetSeconds}
                                    onChange={(e) => setTargetSeconds(e.target.value)}
                                    className="w-full bg-transparent text-slate-800 dark:text-white font-bold text-center outline-none py-3"
                                />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Sec</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-2 ml-1 italic">
                            The AI will attempt to match this duration by adjusting its speaking pace.
                        </p>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !script.trim()}
                        className={`w-full py-5 rounded-3xl font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all shadow-xl border-2 border-white
                            ${isGenerating || !script.trim() 
                                ? 'bg-slate-200 dark:bg-gray-800 text-slate-400 border-slate-300 dark:border-gray-700 cursor-not-allowed' 
                                : 'bg-orange-600 text-white hover:bg-orange-700 active:scale-[0.98]'
                            }
                        `}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Synthesizing Audio...
                            </>
                        ) : (
                            <>
                                <Mic size={20} />
                                Generate Voiceover
                            </>
                        )}
                    </button>

                    {/* Error Display */}
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-shake">
                            <AlertCircle size={20} />
                            <span className="text-xs font-bold uppercase tracking-tight">{error}</span>
                        </div>
                    )}

                    {/* Result Player */}
                    {audioUrl && (
                        <div className="mt-8 p-8 bg-white dark:bg-gray-900 border-2 border-orange-500/20 rounded-[2.5rem] animate-fade-in-up shadow-inner">
                            <div className="flex flex-col items-center gap-6">
                                <div className="w-full flex items-center gap-4">
                                    <button
                                        onClick={togglePlay}
                                        className="w-16 h-16 bg-orange-600 text-white rounded-full flex items-center justify-center hover:bg-orange-700 transition-all shadow-lg active:scale-90"
                                    >
                                        {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
                                    </button>
                                    <div className="flex-grow">
                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                            <div className={`h-full bg-orange-600 transition-all duration-300 ${isPlaying ? 'w-full' : 'w-0'}`}></div>
                                        </div>
                                        <div className="flex justify-between mt-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Preview Ready</span>
                                            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">{style} Style</span>
                                        </div>
                                    </div>
                                </div>

                                <audio 
                                    ref={audioRef} 
                                    onEnded={() => setIsPlaying(false)}
                                    onError={(e) => {
                                        // Don't log the event object directly to avoid circular structure errors
                                        console.error("Audio element error occurred");
                                        setError("The audio player encountered an error. Try generating again.");
                                        setIsPlaying(false);
                                    }}
                                    className="hidden"
                                    preload="auto"
                                >
                                    {audioUrl && <source src={audioUrl} type="audio/wav" />}
                                </audio>

                                <div className="grid grid-cols-2 gap-4 w-full">
                                    <button
                                        onClick={handleDownload}
                                        className="flex items-center justify-center gap-2 py-4 bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-200 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-gray-750 transition-all border border-slate-200 dark:border-gray-700"
                                    >
                                        <Download size={16} />
                                        Download WAV
                                    </button>
                                    <button
                                        onClick={handleUpload}
                                        disabled={isUploading || uploadSuccess}
                                        className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all border-2 border-white shadow-lg
                                            ${uploadSuccess 
                                                ? 'bg-green-600 text-white border-white' 
                                                : isUploading 
                                                    ? 'bg-slate-200 dark:bg-gray-800 text-slate-400 border-slate-300 dark:border-gray-700 cursor-not-allowed'
                                                    : 'bg-slate-900 text-white hover:bg-black'
                                            }
                                        `}
                                    >
                                        {isUploading ? (
                                            <Loader2 className="animate-spin" size={16} />
                                        ) : uploadSuccess ? (
                                            <CheckCircle2 size={16} />
                                        ) : (
                                            <Upload size={16} />
                                        )}
                                        {uploadSuccess ? 'Stored in Supabase' : isUploading ? 'Uploading...' : 'Upload to Supabase'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Voiceover;
