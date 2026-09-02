import React, { useState } from 'react';
import { useTheme } from './ThemeProvider';
import { getSupabaseClient } from '../services/supabaseClient';
import { Tab } from '../types';

// ── Inline SVG icon helper ───────────────────────────────────────────────────
const Icon = ({ d, size = 17 }: { d: string; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0 }}>
        <path d={d} />
    </svg>
);

const PATHS = {
    home:     "M3 9.5L12 3l9 6.5V21a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z M9 22V12h6v10",
    blog:     "M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z",
    image:    "M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21",
    mic:      "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8",
    upload:   "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
    gallery:  "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
    pipeline: "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h7",
    calendar: "M8 2v4 M16 2v4 M3 10h18 M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6z",
    trends:   "M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6",
    audit:    "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h7 M16 5h6 M16 8h6 M16 11h4",
    analyze:  "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    settings: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
    sun:      "M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42 M12 5a7 7 0 000 14A7 7 0 0012 5z",
    moon:     "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
    logout:   "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
    chevron:  "M9 18l6-6-6-6",
    menu:     "M3 12h18 M3 6h18 M3 18h18",
    x:        "M18 6L6 18 M6 6l12 12",
    collapse: "M15 18l-6-6 6-6",
    expand:   "M9 18l6-6-6-6",
};

// ── BIG Logo mark ────────────────────────────────────────────────────────────
const BIGMark = ({ size = 32 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="10" fill="#dc2020" />
        <path d="M22 28H44C52 28 57 33 57 40C57 45 55 48 50 50C56 52 60 57 60 64C60 72 54 76 46 76H22V28ZM33 47H42C46 47 48 45 48 41C48 38 46 36 42 36H33V47ZM33 68H44C48 68 51 66 51 62C51 58 48 56 44 56H33V68Z" fill="white" />
        <rect x="67" y="28" width="11" height="48" fill="white" />
    </svg>
);

// ── Nav data ─────────────────────────────────────────────────────────────────
interface NavItem { id: Tab; label: string; icon: string; badge?: string; }
interface NavGroup { label: string; items: NavItem[]; }

const NAV: NavGroup[] = [
    {
        label: 'Overview',
        items: [
            { id: 'landing',  label: 'Dashboard',       icon: PATHS.home },
        ]
    },
    {
        label: 'Create',
        items: [
            { id: 'blog',      label: 'Blog Architect',  icon: PATHS.blog },
            { id: 'generate',  label: 'Image Studio',    icon: PATHS.image },
        ]
    },
    {
        label: 'Manage',
        items: [
            { id: 'pipeline',  label: 'Content Pipeline',icon: PATHS.pipeline },
            { id: 'calendar',  label: 'Calendar',        icon: PATHS.calendar },
            { id: 'gallery',   label: 'Asset Gallery',   icon: PATHS.gallery },
            { id: 'upload',    label: 'Upload Center',   icon: PATHS.upload },
        ]
    },
    {
        label: 'Intelligence',
        items: [
            { id: 'trends',    label: 'Trend Monitor',   icon: PATHS.trends },
            { id: 'analyze',   label: 'Image Analyzer',  icon: PATHS.analyze },
            { id: 'auditor',   label: 'Content Audit',   icon: PATHS.audit },
        ]
    },
];

// ── Props ────────────────────────────────────────────────────────────────────
interface SidebarProps {
    activeTab: Tab;
    onNavigate: (tab: Tab) => void;
    userEmail?: string;
    uploadQueueCount?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
const Sidebar: React.FC<SidebarProps> = ({ activeTab, onNavigate, userEmail, uploadQueueCount = 0 }) => {
    const { theme, toggleTheme } = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const isExpanded = pinned || expanded;

    const handleSignOut = async () => {
        try { await getSupabaseClient().auth.signOut(); } catch (e) { console.error(e); }
    };

    const handleNav = (tab: Tab) => {
        onNavigate(tab);
        setMobileOpen(false);
    };

    const SidebarContent = ({ forceExpand = false }: { forceExpand?: boolean }) => {
        const show = forceExpand || isExpanded;
        return (
            <div className="flex flex-col h-full overflow-hidden">
                {/* Logo */}
                <div style={{
                    padding: '14px 12px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    minHeight: 60,
                    flexShrink: 0,
                }}>
                    <div style={{ flexShrink: 0 }}>
                        <BIGMark size={30} />
                    </div>
                    <div className="sidebar-label" style={{ opacity: show ? 1 : 0, width: show ? 'auto' : 0 }}>
                        <div style={{
                            fontFamily: 'Space Grotesk, sans-serif',
                            fontWeight: 800,
                            fontSize: 13,
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.02em',
                            lineHeight: 1.1,
                        }}>
                            BIG Studio
                        </div>
                        <div style={{
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'var(--red)',
                            marginTop: 2,
                        }}>
                            Hub · v4.1.0
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
                    {NAV.map(group => (
                        <div key={group.label} style={{ marginBottom: 16 }}>
                            {show && (
                                <div style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    letterSpacing: '0.14em',
                                    textTransform: 'uppercase',
                                    color: 'var(--text-muted)',
                                    padding: '0 10px',
                                    marginBottom: 4,
                                }}>
                                    {group.label}
                                </div>
                            )}
                            {!show && <div style={{ height: 8 }} />}
                            {group.items.map(item => {
                                const isActive = activeTab === item.id;
                                const hasUploadBadge = item.id === 'upload' && uploadQueueCount > 0;
                                return (
                                    <button
                                        key={item.id}
                                        title={!show ? item.label : undefined}
                                        onClick={() => handleNav(item.id)}
                                        className={isActive ? 'nav-active' : 'nav-inactive'}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: show ? '8px 10px' : '8px 0',
                                            justifyContent: show ? 'flex-start' : 'center',
                                            borderRadius: 7,
                                            background: 'none',
                                            cursor: 'pointer',
                                            fontSize: 12,
                                            fontWeight: isActive ? 700 : 500,
                                            fontFamily: 'Space Grotesk, sans-serif',
                                            marginBottom: 2,
                                            transition: 'all 0.15s ease',
                                            position: 'relative',
                                        }}
                                    >
                                        <Icon d={item.icon} size={16} />
                                        <span className="sidebar-label" style={{
                                            opacity: show ? 1 : 0,
                                            width: show ? 'auto' : 0,
                                            flex: 1,
                                            textAlign: 'left',
                                        }}>
                                            {item.label}
                                        </span>
                                        {hasUploadBadge && show && (
                                            <span style={{
                                                background: 'var(--red)',
                                                color: '#fff',
                                                fontSize: 9,
                                                fontWeight: 800,
                                                borderRadius: '50%',
                                                width: 18,
                                                height: 18,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                {uploadQueueCount}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* Bottom controls */}
                <div style={{ borderTop: '1px solid var(--border)', padding: '8px 6px', flexShrink: 0 }}>
                    {/* Settings */}
                    <button
                        title={!show ? 'Settings' : undefined}
                        onClick={() => handleNav('settings')}
                        className={activeTab === 'settings' ? 'nav-active' : 'nav-inactive'}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: show ? '8px 10px' : '8px 0',
                            justifyContent: show ? 'flex-start' : 'center',
                            borderRadius: 7,
                            background: 'none',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: activeTab === 'settings' ? 700 : 500,
                            fontFamily: 'Space Grotesk, sans-serif',
                            marginBottom: 4,
                            transition: 'all 0.15s ease',
                        }}
                    >
                        <Icon d={PATHS.settings} size={16} />
                        <span className="sidebar-label" style={{ opacity: show ? 1 : 0, width: show ? 'auto' : 0 }}>
                            Settings
                        </span>
                    </button>

                    {/* Theme + user row */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: show ? '6px 10px' : '6px 0',
                        justifyContent: show ? 'flex-start' : 'center',
                    }}>
                        <button
                            onClick={toggleTheme}
                            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: 4,
                                borderRadius: 5,
                                display: 'flex',
                                transition: 'color 0.15s',
                            }}
                        >
                            <Icon d={theme === 'dark' ? PATHS.sun : PATHS.moon} size={15} />
                        </button>

                        {show && userEmail && (
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span className="dot-green pulse-red" style={{ background: '#22c55e', animation: 'none' }} />
                                    <span style={{
                                        fontSize: 10,
                                        color: 'var(--text-muted)',
                                        fontWeight: 600,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {userEmail.split('@')[0]}
                                    </span>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleSignOut}
                            title="Sign out"
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: 4,
                                borderRadius: 5,
                                display: 'flex',
                                transition: 'color 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                            <Icon d={PATHS.logout} size={15} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Mobile hamburger */}
            <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden"
                style={{
                    position: 'fixed',
                    top: 14,
                    left: 14,
                    zIndex: 50,
                    padding: 8,
                    borderRadius: 8,
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                }}
            >
                <Icon d={PATHS.menu} size={20} />
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="lg:hidden"
                    onClick={() => setMobileOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 40,
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(4px)',
                    }}
                />
            )}

            {/* Mobile drawer */}
            <div
                className="lg:hidden"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: 220,
                    zIndex: 50,
                    background: 'var(--bg-panel)',
                    borderRight: '1px solid var(--border)',
                    boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
                    transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 0.25s ease',
                }}
            >
                <button
                    onClick={() => setMobileOpen(false)}
                    style={{
                        position: 'absolute',
                        top: 14,
                        right: 12,
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                    }}
                >
                    <Icon d={PATHS.x} size={18} />
                </button>
                <SidebarContent forceExpand />
            </div>

            {/* Desktop sidebar — collapses to icons, expands on hover or pin */}
            <aside
                onMouseEnter={() => !pinned && setExpanded(true)}
                onMouseLeave={() => !pinned && setExpanded(false)}
                className="hidden lg:flex flex-col"
                style={{
                    width: isExpanded ? 220 : 56,
                    flexShrink: 0,
                    height: '100vh',
                    position: 'sticky',
                    top: 0,
                    background: 'var(--bg-panel)',
                    borderRight: '1px solid var(--border)',
                    transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
                    overflow: 'hidden',
                    zIndex: 30,
                }}
            >
                {/* Hamburger pin button — click to lock open, click again to collapse */}
                <button
                    onClick={() => { setPinned(p => !p); setExpanded(false); }}
                    title={pinned ? 'Collapse sidebar' : 'Pin sidebar open'}
                    style={{
                        position: 'absolute',
                        top: 14,
                        right: isExpanded ? 12 : '50%',
                        transform: isExpanded ? 'none' : 'translateX(50%)',
                        background: 'none',
                        border: 'none',
                        color: pinned ? 'var(--red)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 5,
                        display: 'flex',
                        zIndex: 10,
                        transition: 'right 0.22s ease, transform 0.22s ease, color 0.15s',
                    }}
                    onMouseEnter={e => { if (!pinned) e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { if (!pinned) e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <Icon d={PATHS.menu} size={18} />
                </button>
                <SidebarContent />
            </aside>
        </>
    );
};

export default Sidebar;
