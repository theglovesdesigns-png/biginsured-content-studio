import React, { useState } from 'react';

const getEnvPassword = () => {
    if (typeof process !== 'undefined' && process.env && process.env.SITE_PASSWORD) {
        return process.env.SITE_PASSWORD;
    }
    return 'Sarah@2323';
};

const SITE_PASSWORD = getEnvPassword();

interface SitePasswordProps {
    onUnlocked: () => void;
}

const BigLogo = () => (
    <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="20" fill="#EA580C"/>
        <path d="M25 30H45C52 30 56 34 56 40C56 44 54 47 50 49C55 51 58 55 58 60C58 67 53 71 46 71H25V30ZM35 46H43C46 46 48 44 48 41C48 38 46 36 43 36H35V46ZM35 65H45C48 65 50 63 50 60C50 57 48 55 45 55H35V65Z" fill="white"/>
        <rect x="65" y="30" width="10" height="41" fill="white"/>
    </svg>
);

const SitePassword: React.FC<SitePasswordProps> = ({ onUnlocked }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === SITE_PASSWORD) {
            onUnlocked();
        } else {
            setError('Access Denied. Incorrect credential.');
            setPassword('');
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Logo in top left */}
            <div className="absolute top-8 left-8 z-20">
                <BigLogo />
            </div>

            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600"></div>
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl"></div>

            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-10">
                
                {/* Left Side: Branding */}
                <div className="text-center lg:text-left space-y-6">
                    <div className="inline-block px-4 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-xs font-black uppercase tracking-widest mb-4">
                        Secure Creative Hub
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white leading-[1.1] tracking-tighter uppercase">
                        BIGINSURED.com <span className="text-orange-600 block">CONTENT STUDIO</span>
                    </h1>
                    <p className="text-xl text-gray-500 dark:text-gray-400 max-w-lg mx-auto lg:mx-0 font-medium leading-relaxed">
                        Authorized access only. Enter your site credentials to manage blog content and generate office visuals.
                    </p>
                </div>

                {/* Right Side: Password Card */}
                <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-none w-full max-w-md mx-auto">
                    <div className="mb-8">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mb-4 text-orange-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Portal Locked</h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Verify your identity to proceed.</p>
                    </div>
                    
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-4 rounded-xl mb-6 text-sm font-bold border border-red-100 dark:border-red-800 animate-shake">
                             {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Site Password"
                                className="w-full bg-slate-50 dark:bg-gray-800 border-2 border-transparent focus:border-orange-500 rounded-xl p-4 pr-12 focus:outline-none transition shadow-inner dark:text-white font-bold tracking-widest"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 px-4 flex items-center text-gray-400 hover:text-orange-600 transition-colors"
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" /><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" /></svg>
                                )}
                            </button>
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-4 rounded-xl transition-all active:scale-95 shadow-xl"
                        >
                            UNLOCK STUDIO
                        </button>
                    </form>
                </div>
            </div>
            
            <div className="mt-12 text-gray-400 text-[10px] font-bold uppercase tracking-widest z-10 opacity-50">
                &copy; 2026 BIGINSURED.com • Professional Workflow System
            </div>
        </div>
    );
};

export default SitePassword;
