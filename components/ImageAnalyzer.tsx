
import React, { useState, useCallback } from 'react';
import { analyzeImage } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';

// Helper to convert a File object to a base64 string
const fileToBase64 = (file: File): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const [meta, data] = result.split(',');
      const mimeType = meta.split(';')[0].split(':')[1];
      resolve({ data, mimeType });
    };
    reader.onerror = (error) => reject(error);
  });
};

const ImageAnalyzer: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('Describe this image for a blog post. What is happening? Who is the subject? What is the overall mood?');
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (file: File | null) => {
        if (file && file.type.startsWith('image/')) {
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setAnalysisResult(null); // Clear previous result
            setError(null);
        } else {
            setError('Please select a valid image file.');
        }
    };

    const handleAnalyzeClick = async () => {
        if (!imageFile) {
            setError('Please select an image to analyze.');
            return;
        }
        if (!prompt.trim()) {
            setError('Please enter a prompt for the analysis.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        try {
            const { data, mimeType } = await fileToBase64(imageFile);
            const result = await analyzeImage(data, mimeType, prompt);
            setAnalysisResult(result);
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unexpected error occurred during analysis.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileChange(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
            <div className="bg-slate-100 dark:bg-gray-900/50 border border-slate-200 dark:border-gray-700 p-6 rounded-lg shadow-2xl backdrop-blur-sm">
                <div
                    onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
                    onClick={() => document.getElementById('analyzerFileInput')?.click()}
                    className={`w-full p-10 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-300
                        ${isDragging ? 'border-blue-500 bg-gray-800' : 'border-slate-300 dark:border-gray-600 hover:border-blue-500 hover:bg-slate-200/50 dark:hover:bg-gray-800/50'}`}
                >
                    <input type="file" id="analyzerFileInput" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)} />
                    {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="max-h-48 rounded-md shadow-lg" />
                    ) : (
                        <>
                             <svg className="w-12 h-12 text-gray-400 dark:text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <p className="mt-2 text-lg font-semibold text-gray-600 dark:text-gray-300">Drop an image here to analyze</p>
                            <p className="text-sm text-gray-500 dark:text-gray-500">or click to browse</p>
                        </>
                    )}
                </div>

                {imageFile && (
                    <div className="mt-6 flex flex-col gap-4">
                         <div>
                            <label htmlFor="analysis-prompt" className="text-sm font-medium text-gray-500 dark:text-gray-400">Analysis Prompt</label>
                            <textarea
                                id="analysis-prompt"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="mt-1 w-full bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200 resize-y h-28"
                                disabled={isLoading}
                            />
                        </div>
                        <button onClick={handleAnalyzeClick} disabled={isLoading || !imageFile} className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-md transition duration-200 shadow-lg hover:shadow-blue-500/50">
                            {isLoading ? 'Analyzing...' : 'Analyze Image'}
                        </button>
                    </div>
                )}
            </div>
            
            <div className="mt-4">
                {isLoading && <div className="w-full aspect-video flex items-center justify-center"><LoadingSpinner /></div>}
                {error && !isLoading && <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg"><strong className="font-bold">Error: </strong>{error}</div>}
                {analysisResult && !isLoading && (
                    <div className="bg-slate-100 dark:bg-gray-900/50 border border-slate-200 dark:border-gray-700 p-6 rounded-lg">
                        <h3 className="text-xl font-bold text-blue-500 dark:text-blue-400 mb-3">Analysis Result</h3>
                        <div className="prose dark:prose-invert max-w-none prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 whitespace-pre-wrap">{analysisResult}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageAnalyzer;
