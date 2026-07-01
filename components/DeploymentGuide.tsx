
import React from 'react';

interface DeploymentGuideProps {
    isOpen: boolean;
    onClose: () => void;
}

const DeploymentGuide: React.FC<DeploymentGuideProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        Deployment Guide
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div className="p-6 space-y-6 text-gray-600 dark:text-gray-300">
                    <p>
                        To let your staff use this app, you need to deploy it to a hosting provider. We recommend <strong>Vercel</strong> as it's free for personal use and integrates easily with React/Vite apps.
                    </p>

                    <div className="bg-slate-100 dark:bg-gray-800 p-4 rounded-lg border-l-4 border-orange-500">
                        <h3 className="font-bold text-slate-900 dark:text-white mb-2">Required Environment Variables</h3>
                        <p className="text-sm mb-3">
                            When deploying, you <strong>MUST</strong> add these variables in your hosting project settings (e.g., Vercel &gt; Settings &gt; Environment Variables). The app will not work without them.
                        </p>
                        <ul className="space-y-2 text-sm font-mono bg-slate-200 dark:bg-black/50 p-3 rounded">
                            <li className="flex flex-col sm:flex-row sm:gap-4">
                                <span className="font-bold text-blue-600 dark:text-blue-400 min-w-[240px]">API_KEY</span>
                                <span className="opacity-75">Your Google Gemini API Key</span>
                            </li>
                            <li className="flex flex-col sm:flex-row sm:gap-4">
                                <span className="font-bold text-blue-600 dark:text-blue-400 min-w-[240px]">SUPABASE_URL</span>
                                <span className="opacity-75">Your Supabase Project URL</span>
                            </li>
                            <li className="flex flex-col sm:flex-row sm:gap-4">
                                <span className="font-bold text-blue-600 dark:text-blue-400 min-w-[240px]">SUPABASE_ANON_KEY</span>
                                <span className="opacity-75">Your Supabase Public/Anon Key</span>
                            </li>
                            <li className="flex flex-col sm:flex-row sm:gap-4">
                                <span className="font-bold text-blue-600 dark:text-blue-400 min-w-[240px]">GOOGLE_SHEETS_WEBHOOK_URL</span>
                                <span className="opacity-75">(Optional) Connect Sheets automatically for everyone</span>
                            </li>
                            <li className="flex flex-col sm:flex-row sm:gap-4">
                                <span className="font-bold text-blue-600 dark:text-blue-400 min-w-[240px]">SITE_PASSWORD</span>
                                <span className="opacity-75">(Optional) Password to lock the site</span>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Deployment Steps (Vercel)</h3>
                        <ol className="list-decimal list-inside space-y-2 ml-2">
                            <li>Push this code to a <strong>GitHub</strong> repository.</li>
                            <li>Go to <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-orange-500 hover:underline">Vercel.com</a> and sign up/login.</li>
                            <li>Click <strong>"Add New..."</strong> &gt; <strong>"Project"</strong>.</li>
                            <li>Import your GitHub repository.</li>
                            <li>
                                In the <strong>"Configure Project"</strong> screen, expand <strong>"Environment Variables"</strong>.
                            </li>
                            <li>Add the variables listed above (copy values from your local setup or Supabase/Google dashboards).</li>
                            <li>Click <strong>Deploy</strong>.</li>
                        </ol>
                    </div>

                    <div className="text-sm text-gray-500 dark:text-gray-400 border-t border-slate-200 dark:border-gray-700 pt-4">
                        <p>
                            <strong>Note:</strong> If you see a "Build Failed" error regarding types, ensure your `package.json` includes `@google/genai` and `@supabase/supabase-js` in dependencies.
                        </p>
                    </div>
                </div>
                
                <div className="p-6 border-t border-slate-200 dark:border-gray-700 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeploymentGuide;
