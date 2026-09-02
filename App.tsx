import React, { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './components/Sidebar';
import ImageGenerator from './components/ImageGenerator';
import Uploader from './components/Uploader';
import ImageAnalyzer from './components/ImageAnalyzer';
import Gallery from './components/Gallery';
import BlogBuilder from './components/BlogBuilder';
import Pipeline from './components/Pipeline';
import Trends from './components/Trends';
import ContentCalendar from './components/ContentCalendar';
import LandingPage from './components/LandingPage';
import Settings from './components/Settings';
import Auth from './components/Auth';
import SheetAuditor from './components/SheetAuditor';
import PageShell from './components/PageShell';
import { ManagedFile, Tab, GeneratorPrompt } from './types';
import { isSupabaseConfigured, getSupabaseClient } from './services/supabaseClient';
import { User } from '@supabase/supabase-js';
import { ThemeProvider } from './components/ThemeProvider';
import SitePassword from './components/SitePassword';

const App: React.FC = () => {
    const [isConfigured, setIsConfigured] = useState(isSupabaseConfigured());
    const [isUnlocked, setIsUnlocked] = useState(() => localStorage.getItem('site_unlocked') === 'true');
    const [user, setUser] = useState<User | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const validTabs: Tab[] = ['landing', 'settings', 'generate', 'analyze', 'upload', 'gallery', 'blog', 'pipeline', 'trends', 'calendar', 'auditor'];
        return (validTabs.includes(tab as Tab)) ? (tab as Tab) : 'landing';
    });
    const [uploadQueue, setUploadQueue] = useState<ManagedFile[]>([]);
    const [generatorPrompt, setGeneratorPrompt] = useState<GeneratorPrompt | null>(null);

    const clearStaleSession = useCallback(() => {
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('supabase.auth.token') || key.startsWith('sb-') || key.includes('token'))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            const supabase = getSupabaseClient();
            supabase.auth.signOut({ scope: 'local' }).catch(() => {}).finally(() => {
                window.location.reload();
            });
        } catch (e) {
            window.location.reload();
        }
    }, []);

    useEffect(() => {
        const handleGlobalError = (event: ErrorEvent) => {
            const msg = event.message || (event.error && event.error.message);
            if (msg && (msg.includes('Refresh Token') || msg.includes('Session Expired') || msg.includes('invalid_grant'))) {
                clearStaleSession();
            }
        };
        window.addEventListener('error', handleGlobalError);
        return () => window.removeEventListener('error', handleGlobalError);
    }, [clearStaleSession]);

    useEffect(() => {
        if (!isConfigured) {
            setIsCheckingAuth(false);
            return;
        }
        let supabase: ReturnType<typeof getSupabaseClient> | null = null;
        try {
            supabase = getSupabaseClient();
        } catch (e) {
            setIsCheckingAuth(false);
            return;
        }

        const getInitialSession = async () => {
            try {
                const { data: { session }, error } = await supabase!.auth.getSession();
                if (error) {
                    if (error.message.includes('Refresh Token') || error.message.includes('invalid_grant')) {
                        clearStaleSession(); return;
                    }
                }
                setUser(session?.user ?? null);
            } catch (e) {
                setUser(null);
            } finally {
                setIsCheckingAuth(false);
            }
        };
        getInitialSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });
        return () => subscription?.unsubscribe();
    }, [isConfigured, clearStaleSession]);

    const navigate = useCallback((tab: Tab) => {
        setActiveTab(tab);
        window.history.pushState({}, '', `?tab=${tab}`);
    }, []);

    const handleAddToUploadQueue = useCallback((image: { url: string; name: string }) => {
        const newFile: ManagedFile = {
            id: uuidv4(),
            file: new File([], image.name),
            previewUrl: image.url,
            status: 'queued',
            progress: 0,
        };
        setUploadQueue(prev => [...prev, newFile]);
        navigate('upload');
    }, [navigate]);

    const handleSendToGenerator = useCallback((prompt: GeneratorPrompt) => {
        setGeneratorPrompt(prompt);
        navigate('generate');
    }, [navigate]);

    // Note: a "Supabase not configured" gate previously lived here using a
    // separate component (SupabaseAuth.tsx) that asked for Project URL / Anon
    // Key. That's been removed — config.ts already has working hardcoded
    // Supabase credentials as a fallback, so isConfigured is reliably true.
    // The real login screen (email/password) is the gate below.

    // ── Gate: site password ────────────────────────────────────────────────
    if (!isUnlocked) {
        return (
            <ThemeProvider>
                <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <SitePassword onUnlocked={() => setIsUnlocked(true)} />
                </div>
            </ThemeProvider>
        );
    }

    // ── Gate: auth check in progress ───────────────────────────────────────
    if (isCheckingAuth) {
        return (
            <ThemeProvider>
                <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-slate-500 dark:text-gray-500 font-medium">Loading Studio...</p>
                    </div>
                </div>
            </ThemeProvider>
        );
    }

    // ── Gate: login ────────────────────────────────────────────────────────
    if (!user) {
        return (
            <ThemeProvider>
                <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <Auth onLoginSuccess={() => { /* onAuthStateChange listener updates `user` automatically */ }} />
                </div>
            </ThemeProvider>
        );
    }

    // ── Active tab render ──────────────────────────────────────────────────
    const renderContent = () => {
        switch (activeTab) {
            case 'landing':
                return <LandingPage onNavigate={navigate} />;
            case 'blog':
                return (
                    <PageShell
                        title="Blog Architect"
                        subtitle="Generate SEO blog posts and series strategies"
                        accentColor="var(--red)"
                        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
                        maxWidth={1100}
                    >
                        <BlogBuilder onSendImagePrompt={handleSendToGenerator} />
                    </PageShell>
                );
            case 'generate':
                return (
                    <PageShell
                        title="Image Studio"
                        subtitle="AI-powered image generation for web, social, and YouTube"
                        accentColor="var(--blue)"
                        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21"/></svg>}
                        maxWidth={1100}
                    >
                        <ImageGenerator
                            onAddToUploadQueue={handleAddToUploadQueue}
                            externalPrompt={generatorPrompt}
                            onPromptConsumed={() => setGeneratorPrompt(null)}
                        />
                    </PageShell>
                );
            case 'analyze':
                return <ImageAnalyzer />;
            case 'upload':
                return <Uploader initialQueue={uploadQueue} onQueueChange={setUploadQueue} />;
            case 'gallery':
                return <Gallery onSendToGenerator={handleAddToUploadQueue} />;
            case 'pipeline':
                return <Pipeline onNavigate={navigate} />;
            case 'calendar':
                return <ContentCalendar />;
            case 'trends':
                return <Trends onNavigate={navigate} />;
            case 'auditor':
                return <SheetAuditor />;
            case 'settings':
                return <Settings />;
            default:
                return <LandingPage onNavigate={navigate} />;
        }
    };

    return (
        <ThemeProvider>
            <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
                <Sidebar
                    activeTab={activeTab}
                    onNavigate={navigate}
                    userEmail={user.email}
                    uploadQueueCount={uploadQueue.filter(f => f.status === 'queued').length}
                />
                <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }} className="content-scroll animate-fade-in">
                    {renderContent()}
                </main>
            </div>
        </ThemeProvider>
    );
};

export default App;
