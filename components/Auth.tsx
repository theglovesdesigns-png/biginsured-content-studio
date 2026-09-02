import React, { useState } from 'react';
import { getSupabaseClient } from '../services/supabaseClient';

interface AuthProps {
    onLoginSuccess: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);
        
        try {
            const supabase = getSupabaseClient();
            
            // Define a timeout promise
            const timeout = (ms: number) => new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('TIMEOUT')), ms)
            );

            if (isSignUp) {
                const signUpPromise = supabase.auth.signUp({ 
                    email, 
                    password,
                }).then(({ error }) => {
                    if (error) throw error;
                });
                await Promise.race([signUpPromise, timeout(10000)]);
                
                setMessage('Account created! You can now Sign In below. (If you see an error, ensure "Confirm Email" is disabled in Supabase Settings)');
                setIsSignUp(false);
            } else {
                const signInPromise = supabase.auth.signInWithPassword({ email, password }).then(({ error }) => {
                    if (error) throw error;
                });
                await Promise.race([signInPromise, timeout(10000)]);
                onLoginSuccess();
            }
        } catch (err) {
            let msg = err instanceof Error ? err.message : 'An unknown error occurred.';
            if (msg === 'TIMEOUT') {
                msg = 'Connection to Supabase timed out. Your Supabase project might be paused, inactive, or there is a database network issue. Please check your Supabase dashboard or re-configure Database Keys.';
            } else if (msg.includes('Email not confirmed')) {
                msg = 'Email not confirmed. Admin: Disable "Confirm Email" in Supabase Authentication settings to bypass this.';
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Abstract Background Accents */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600"></div>
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl"></div>

            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-10">
                
                {/* Left Side: Professional Landing Message */}
                <div className="text-center lg:text-left space-y-6">
                    <div className="inline-block px-4 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-xs font-black uppercase tracking-widest mb-4">
                        Internal Office Portal
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white leading-[1.1] tracking-tighter uppercase">
                        BIGINSURED.com <span className="text-orange-600 block">CONTENT STUDIO</span>
                    </h1>
                    <p className="text-xl text-gray-500 dark:text-gray-400 max-w-lg mx-auto lg:mx-0 font-medium leading-relaxed">
                        The unified creative hub. Generate SEO-perfect blog posts and custom 2K visuals for the office.
                    </p>
                    
                    <div className="pt-6">
                        <button 
                            onClick={() => setShowHelp(!showHelp)}
                            className="text-xs font-bold text-slate-400 hover:text-orange-500 uppercase tracking-widest flex items-center gap-2 mx-auto lg:mx-0 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.443 1.103m-2.454 2.19a1 1 0 112 0 1 1 0 01-2 0z" /></svg>
                            Can't log in? Admin Setup Guide
                        </button>
                        
                        {showHelp && (
                            <div className="mt-4 p-4 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl text-left animate-fade-in max-w-md mx-auto lg:mx-0">
                                <h4 className="font-black text-[10px] text-orange-600 uppercase mb-2">Supabase Settings Required:</h4>
                                <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
                                    <li>In Supabase: <strong>Authentication &gt; Providers &gt; Email</strong></li>
                                    <li>Ensure <strong>"Confirm Email"</strong> is toggled <strong>OFF</strong>.</li>
                                    <li>Ensure <strong>"Allow new users to sign up"</strong> is <strong>ON</strong>.</li>
                                    <li><strong>Save</strong> settings and then use the "Create Access" tab here.</li>
                                </ol>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Auth Form */}
                <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-none w-full max-w-md mx-auto">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                        {isSignUp ? 'New Account' : 'Staff Sign In'}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium text-sm">
                        {isSignUp ? 'Create your unique office login below.' : 'Access your creative workspace.'}
                    </p>
                    
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-4 rounded-xl mb-6 text-xs flex items-start gap-3 border border-red-100 dark:border-red-800">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                             {error}
                        </div>
                    )}
                    {message && (
                        <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 p-4 rounded-xl mb-6 text-xs border border-green-100 dark:border-green-800 font-bold">
                            {message}
                        </div>
                    )}

                    <form onSubmit={handleAuth} className="space-y-5">
                        <div>
                            <label htmlFor="email" className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1 ml-1">
                                Office Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="name@biginsured.com"
                                className="w-full bg-slate-50 dark:bg-gray-800 border-2 border-transparent focus:border-orange-500 dark:focus:border-orange-600 rounded-xl p-3 focus:outline-none transition shadow-inner dark:text-white text-sm"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1 ml-1">
                                <label htmlFor="password"className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                    Password
                                </label>
                            </div>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                placeholder="••••••••"
                                className="w-full bg-slate-50 dark:bg-gray-800 border-2 border-transparent focus:border-orange-500 dark:focus:border-orange-600 rounded-xl p-3 focus:outline-none transition shadow-inner dark:text-white text-sm"
                            />
                        </div>
                        
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white font-black py-4 rounded-xl transition-all active:scale-95 shadow-[0_10px_20px_rgba(234,88,12,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Processing...
                                </span>
                            ) : (isSignUp ? 'CREATE OFFICE ACCESS' : 'SIGN INTO STUDIO')}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-100 dark:border-gray-800 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            {isSignUp ? 'Already have an account?' : "First time using the studio?"}
                            <button onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }} className="font-black text-orange-600 hover:text-orange-500 ml-2 uppercase tracking-tight">
                                {isSignUp ? 'Sign In Instead' : 'Create Access'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-12 text-gray-400 text-[10px] font-bold uppercase tracking-widest z-10 opacity-50">
                &copy; 2026 BIGINSURED.com Content Studio • Private Office System
            </div>
        </div>
    );
};

export default Auth;
