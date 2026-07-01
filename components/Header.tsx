
import React, { useState } from 'react';
import { useTheme } from './ThemeProvider';
import { clearSupabaseCredentials, getSupabaseClient } from '../services/supabaseClient';
import DeploymentGuide from './DeploymentGuide';

const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);

const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
);

const RocketIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
);

const BigLogo = () => (
    <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_15px_rgba(234,88,12,0.4)]">
        <rect width="100" height="100" rx="20" fill="#EA580C"/>
        <path d="M25 30H45C52 30 56 34 56 40C56 44 54 47 50 49C55 51 58 55 58 60C58 67 53 71 46 71H25V30ZM35 46H43C46 46 48 44 48 41C48 38 46 36 43 36H35V46ZM35 65H45C48 65 50 63 50 60C50 57 48 55 45 55H35V65Z" fill="white"/>
        <rect x="65" y="30" width="10" height="41" fill="white"/>
    </svg>
);

interface HeaderProps {
    userEmail?: string;
}

const Header: React.FC<HeaderProps> = ({ userEmail }) => {
    const { theme, toggleTheme } = useTheme();
    const [showDeployGuide, setShowDeployGuide] = useState(false);

    const handleSignOut = async () => {
        try {
            await getSupabaseClient().auth.signOut();
        } catch (e) {
            console.error("Sign out error:", e);
        }
    };
    
    const handleResetSystem = () => {
        if (window.confirm("ADMIN ONLY: This will clear the technical connection keys. Continue?")) {
            clearSupabaseCredentials();
            window.location.reload();
        }
    };

    return (
        <header className="relative my-8 md:my-12">
            <DeploymentGuide isOpen={showDeployGuide} onClose={() => setShowDeployGuide(false)} />
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-shrink-0 w-full md:w-auto flex justify-start">
                    <BigLogo />
                </div>

                <div className="text-center flex-grow">
                    <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 dark:text-white uppercase leading-none font-display">
                        BIGINSURED.com <span className="text-orange-600 block sm:inline">STUDIO</span>
                    </h1>
                    {userEmail && (
                        <div className="mt-2 flex items-center justify-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                             <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Staff Active: {userEmail}</span>
                        </div>
                    )}
                </div>

                <div className="flex-shrink-0 flex items-center gap-4">
                    <button
                        onClick={() => setShowDeployGuide(true)}
                        className="flex items-center text-xs font-bold bg-slate-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-full hover:text-orange-600 transition-colors"
                    >
                        <RocketIcon /> Help
                    </button>
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors border border-slate-200 dark:border-gray-700"
                    >
                        {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                    </button>
                    <div className="flex flex-col items-end">
                        <button
                            onClick={handleSignOut}
                            className="text-xs font-bold text-orange-600 hover:text-orange-500 transition-colors px-2 py-1 uppercase tracking-tight"
                        >
                            Sign Out
                        </button>
                        <button
                            onClick={handleResetSystem}
                            className="text-[9px] text-gray-400 hover:text-gray-600 transition-colors px-2 py-0 uppercase"
                        >
                            Reset Tech Keys
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
