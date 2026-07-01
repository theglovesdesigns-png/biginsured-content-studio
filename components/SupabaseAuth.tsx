
import React, { useState } from 'react';
import { initializeSupabase } from '../services/supabaseClient';

interface SupabaseAuthProps {
    onAuthenticated: () => void;
}

const BigLogo = () => (
    <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="20" fill="#EA580C"/>
        <path d="M25 30H45C52 30 56 34 56 40C56 44 54 47 50 49C55 51 58 55 58 60C58 67 53 71 46 71H25V30ZM35 46H43C46 46 48 44 48 41C48 38 46 36 43 36H35V46ZM35 65H45C48 65 50 63 50 60C50 57 48 55 45 55H35V65Z" fill="white"/>
        <rect x="65" y="30" width="10" height="41" fill="white"/>
    </svg>
);

const SupabaseAuth: React.FC<SupabaseAuthProps> = ({ onAuthenticated }) => {
    const [url, setUrl] = useState('');
    const [anonKey, setAnonKey] = useState('');
    const [error, setError] = useState('');

    const handleConnect = () => {
        if (!url.trim() || !anonKey.trim()) {
            setError('Both URL and Anon Key are required.');
            return;
        }
        try {
            initializeSupabase(url, anonKey);
            onAuthenticated();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-50 dark:bg-black z-50 flex items-center justify-center p-4">
            {/* Logo in top left */}
            <div className="absolute top-8 left-8 z-[60]">
                <BigLogo />
            </div>

            <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col md:flex-row">
                {/* Left Side: Branding/Help */}
                <div className="bg-orange-600 p-8 text-white md:w-1/3 flex flex-col justify-center">
                    <div className="mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">System Setup</h2>
                    <p className="text-orange-100 text-sm leading-relaxed">
                        The Content Studio requires a one-time connection to your database.
                    </p>
                    <div className="mt-8 pt-8 border-t border-orange-500">
                        <p className="text-xs font-bold uppercase tracking-widest text-orange-200 mb-2">Staff Note:</p>
                        <p className="text-xs text-orange-100 italic">
                            If you see this screen, please contact your office administrator to input the system keys.
                        </p>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="p-8 md:w-2/3 flex flex-col justify-center">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Database Keys</h3>
                    
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 p-3 rounded-lg text-sm mb-6 flex items-start gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Project URL</label>
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://abc.supabase.co"
                                className="w-full bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Anon (Public) Key</label>
                            <input
                                type="password"
                                value={anonKey}
                                onChange={(e) => setAnonKey(e.target.value)}
                                placeholder="Paste your anon key here..."
                                className="w-full bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleConnect}
                        className="w-full mt-8 bg-slate-900 dark:bg-white text-white dark:text-black font-black py-4 rounded-lg transition-all active:scale-95 hover:bg-slate-800 dark:hover:bg-slate-100 shadow-xl"
                    >
                        INITIALIZE SYSTEM
                    </button>
                    
                    <p className="mt-6 text-center text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                        Tip: Hardcode these in <code>services/config.ts</code> to hide this screen permanently.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SupabaseAuth;
