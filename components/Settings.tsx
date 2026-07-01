
import React, { useState, useEffect } from 'react';
import { SUPABASE_CONFIG } from '../services/config';
import { clearSupabaseCredentials, initializeSupabase } from '../services/supabaseClient';

const Settings: React.FC = () => {
    const [sheetUrl, setSheetUrl] = useState('');
    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    useEffect(() => {
        // Sheet URL
        const configSheetUrl = SUPABASE_CONFIG.GOOGLE_SHEETS_WEBHOOK_URL;
        const savedSheetUrl = localStorage.getItem('googleSheetsWebhookUrl');
        if (configSheetUrl) setSheetUrl(configSheetUrl);
        else if (savedSheetUrl) setSheetUrl(savedSheetUrl);

        // Supabase URL
        const configSupabaseUrl = SUPABASE_CONFIG.SUPABASE_URL;
        const savedSupabaseUrl = localStorage.getItem('supabase.url');
        if (configSupabaseUrl) setSupabaseUrl(configSupabaseUrl);
        else if (savedSupabaseUrl) setSupabaseUrl(savedSupabaseUrl);

        // Supabase Anon Key
        const configSupabaseKey = SUPABASE_CONFIG.SUPABASE_ANON_KEY;
        const savedSupabaseKey = localStorage.getItem('supabase.anonKey');
        if (configSupabaseKey) setSupabaseAnonKey(configSupabaseKey);
        else if (savedSupabaseKey) setSupabaseAnonKey(savedSupabaseKey);
    }, []);

    const handleSave = () => {
        try {
            localStorage.setItem('googleSheetsWebhookUrl', sheetUrl);
            
            // If the user changed Supabase info, re-initialize
            const currentUrl = localStorage.getItem('supabase.url');
            const currentKey = localStorage.getItem('supabase.anonKey');
            
            if (supabaseUrl !== currentUrl || supabaseAnonKey !== currentKey) {
                initializeSupabase(supabaseUrl, supabaseAnonKey);
            }

            setStatus({ type: 'success', message: 'Settings saved successfully!' });
            setTimeout(() => setStatus(null), 3000);
        } catch (error) {
            setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Failed to save settings' });
        }
    };

    const handleReset = () => {
        if (window.confirm('Are you sure you want to reset the system? This will clear your database connection and log you out.')) {
            clearSupabaseCredentials();
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-4 animate-fade-in">
            <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-12 flex items-center gap-4">
                <span className="w-3 h-12 bg-orange-600 rounded-full"></span>
                System Settings
            </h2>

            <div className="bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-[3rem] p-12 shadow-2xl">
                <div className="space-y-12">
                    <section>
                        <div className="mb-6">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Database Configuration</h3>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Manage your Supabase connection keys.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-4">
                                <label className="block text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] ml-1">Supabase Project URL</label>
                                <input 
                                    type="text" 
                                    value={supabaseUrl} 
                                    onChange={(e) => setSupabaseUrl(e.target.value)} 
                                    placeholder="https://your-project.supabase.co" 
                                    className="w-full bg-slate-50 dark:bg-gray-900 border-2 border-slate-200 dark:border-gray-800 rounded-2xl p-5 text-sm outline-none focus:border-orange-500 font-bold dark:text-white transition-all" 
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="block text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] ml-1">Supabase Anon Key</label>
                                <input 
                                    type="password" 
                                    value={supabaseAnonKey} 
                                    onChange={(e) => setSupabaseAnonKey(e.target.value)} 
                                    placeholder="your-anon-key" 
                                    className="w-full bg-slate-50 dark:bg-gray-900 border-2 border-slate-200 dark:border-gray-800 rounded-2xl p-5 text-sm outline-none focus:border-orange-500 font-bold dark:text-white transition-all" 
                                />
                            </div>
                        </div>
                    </section>

                    <section className="pt-12 border-t border-slate-100 dark:border-gray-900">
                        <div className="mb-6">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Google Sheets Integration</h3>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Configure the webhook for content transmission.</p>
                        </div>
                        
                        <div className="space-y-4">
                            <label className="block text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] ml-1">Apps Script Webhook URL</label>
                            <input 
                                type="text" 
                                value={sheetUrl} 
                                onChange={(e) => setSheetUrl(e.target.value)} 
                                placeholder="https://script.google.com/macros/s/.../exec" 
                                className="w-full bg-slate-50 dark:bg-gray-900 border-2 border-slate-200 dark:border-gray-800 rounded-2xl p-5 text-sm outline-none focus:border-orange-500 font-bold dark:text-white transition-all" 
                            />
                        </div>
                    </section>

                    <section className="pt-12 border-t border-slate-100 dark:border-gray-900">
                        <div className="mb-6">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">System Information</h3>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Current environment and version data.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-50 dark:bg-gray-900 p-6 rounded-2xl border border-slate-100 dark:border-gray-800">
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">App Version</span>
                                <span className="text-sm font-black dark:text-white">v2.5.0-production</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-gray-900 p-6 rounded-2xl border border-slate-100 dark:border-gray-800">
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Environment</span>
                                <span className="text-sm font-black dark:text-white">Cloud Run / Ohio-West</span>
                            </div>
                        </div>
                    </section>

                    <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
                        <button 
                            onClick={handleReset}
                            className="px-8 py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-red-600 hover:text-white transition-all"
                        >
                            Reset System Connection
                        </button>
                        
                        <div className="flex items-center gap-6 ml-auto">
                            {status && (
                                <span className={`text-xs font-black uppercase tracking-widest ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {status.message}
                                </span>
                            )}
                            <button 
                                onClick={handleSave}
                                className="px-12 py-5 bg-orange-600 text-white font-black text-lg uppercase tracking-tighter rounded-2xl shadow-xl hover:-translate-y-1 transition-all active:scale-95 border-2 border-white"
                            >
                                Save Configuration
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
