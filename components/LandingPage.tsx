import React, { useEffect, useState } from 'react';
import { Tab } from '../types';

interface LandingPageProps {
    onNavigate: (tab: Tab) => void;
}

const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
    </svg>
);

const ICONS = {
    blog:     "M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z",
    image:    "M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21",
    mic:      "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8",
    pipeline: "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h7",
    calendar: "M8 2v4 M16 2v4 M3 10h18 M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6z",
    trends:   "M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6",
    audit:    "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h7 M16 5h6 M16 8h6 M16 11h4",
    analyze:  "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    gallery:  "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
    upload:   "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
    arrow:    "M5 12h14 M12 5l7 7-7 7",
    check:    "M20 6L9 17l-5-5",
    clock:    "M12 2a10 10 0 110 20A10 10 0 0112 2z M12 6v6l4 2",
};

// Mini calendar component
const MiniCalendar: React.FC = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                    {MONTHS[month]} {year}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>
                    Today
                </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {DAYS.map(d => (
                    <div key={d} style={{
                        textAlign: 'center',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        color: 'var(--text-muted)',
                        padding: '0 0 6px 0',
                    }}>{d}</div>
                ))}
                {cells.map((day, i) => (
                    <div key={i} style={{
                        textAlign: 'center',
                        fontSize: 11,
                        fontFamily: 'JetBrains Mono',
                        fontWeight: day === today ? 700 : 400,
                        color: day === today ? '#fff' : day ? 'var(--text-secondary)' : 'transparent',
                        background: day === today ? 'var(--red)' : 'transparent',
                        borderRadius: 5,
                        padding: '4px 2px',
                        lineHeight: 1.4,
                        cursor: day ? 'default' : undefined,
                    }}>
                        {day ?? ''}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Tool card for the grid
interface ToolCardProps {
    id: Tab;
    label: string;
    desc: string;
    icon: string;
    accentColor: string;
    onNavigate: (tab: Tab) => void;
}

const ToolCard: React.FC<ToolCardProps> = ({ id, label, desc, icon, accentColor, onNavigate }) => (
    <button
        onClick={() => onNavigate(id)}
        className="card card-clickable"
        style={{
            padding: 16,
            textAlign: 'left',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            cursor: 'pointer',
            background: 'var(--bg-panel)',
        }}
    >
        <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: accentColor + '18',
            border: `1.5px solid ${accentColor}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accentColor,
            flexShrink: 0,
        }}>
            <Icon d={icon} size={16} />
        </div>
        <div>
            <div style={{
                fontFamily: 'Space Grotesk',
                fontWeight: 700,
                fontSize: 13,
                color: 'var(--text-primary)',
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
            }}>
                {label}
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    <Icon d={ICONS.arrow} size={12} />
                </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {desc}
            </div>
        </div>
    </button>
);

// Quick action button
const QuickBtn: React.FC<{ label: string; tab: Tab; color: string; onNavigate: (t: Tab) => void }> = ({ label, tab, color, onNavigate }) => (
    <button
        onClick={() => onNavigate(tab)}
        className="btn"
        style={{
            background: color,
            color: '#fff',
            borderColor: '#000',
            flex: 1,
            justifyContent: 'center',
            minWidth: 0,
        }}
    >
        {label}
    </button>
);

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: '100vh' }}>
            {/* Top header bar */}
            <div className="top-header">
                <span style={{
                    fontFamily: 'Space Grotesk',
                    fontWeight: 800,
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                    marginRight: 16,
                }}>
                    BIG Content Studio
                </span>
                <div style={{ flex: 1 }} />
                {/* Live clock */}
                <span style={{
                    fontFamily: 'JetBrains Mono',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    marginRight: 12,
                }}>
                    {dateStr}
                </span>
                <span style={{
                    fontFamily: 'JetBrains Mono',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--red)',
                    background: 'var(--red-dim)',
                    padding: '3px 10px',
                    borderRadius: 5,
                    border: '1px solid rgba(220,32,32,0.2)',
                }}>
                    {timeStr}
                </span>
            </div>

            {/* Main content */}
            <div style={{ padding: '24px 24px 40px', flex: 1 }}>
                {/* Page title */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'var(--red)',
                            background: 'var(--red-dim)',
                            padding: '3px 10px',
                            borderRadius: 4,
                            border: '1px solid rgba(220,32,32,0.2)',
                        }}>
                            <span className="dot-green" style={{ width: 5, height: 5 }} />
                            Live Dashboard
                        </span>
                    </div>
                    <h1 style={{
                        fontFamily: 'Space Grotesk',
                        fontWeight: 800,
                        fontSize: 26,
                        color: 'var(--text-primary)',
                        margin: 0,
                        letterSpacing: '-0.03em',
                        lineHeight: 1.1,
                    }}>
                        Content Intelligence Hub
                    </h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontWeight: 400 }}>
                        Bradley Insurance Group · Canal Winchester, OH
                    </p>
                </div>

                {/* Quick actions */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                    <QuickBtn label="New Blog Post"    tab="blog"     color="var(--red)"  onNavigate={onNavigate} />
                    <QuickBtn label="Generate Image"   tab="generate" color="var(--blue)" onNavigate={onNavigate} />
                    <QuickBtn label="View Pipeline"    tab="pipeline" color="#18181f"      onNavigate={onNavigate} />
                    <QuickBtn label="Trend Monitor"    tab="trends"   color="#166534"      onNavigate={onNavigate} />
                </div>

                {/* Main 2-col layout: tools grid left, calendar + stats right */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>
                    {/* Left: tool sections */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Create section */}
                        <div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                marginBottom: 10,
                            }}>
                                <span style={{
                                    fontFamily: 'Space Grotesk',
                                    fontWeight: 800,
                                    fontSize: 11,
                                    letterSpacing: '0.1em',
                                    textTransform: 'uppercase',
                                    color: 'var(--red)',
                                }}>
                                    Create
                                </span>
                                <div className="divider" style={{ flex: 1 }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                                <ToolCard id="blog"      label="Blog Architect" desc="Full SEO posts + series strategies"         icon={ICONS.blog}     accentColor="var(--red)"   onNavigate={onNavigate} />
                                <ToolCard id="generate"  label="Image Studio"   desc="AI visuals for web, social, YouTube"        icon={ICONS.image}    accentColor="var(--blue)"  onNavigate={onNavigate} />
                            </div>
                        </div>

                        {/* Manage section */}
                        <div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                marginBottom: 10,
                            }}>
                                <span style={{
                                    fontFamily: 'Space Grotesk',
                                    fontWeight: 800,
                                    fontSize: 11,
                                    letterSpacing: '0.1em',
                                    textTransform: 'uppercase',
                                    color: 'var(--blue)',
                                }}>
                                    Manage
                                </span>
                                <div className="divider" style={{ flex: 1 }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                                <ToolCard id="pipeline" label="Content Pipeline" desc="Kanban board from idea to published"       icon={ICONS.pipeline} accentColor="#f59e0b"      onNavigate={onNavigate} />
                                <ToolCard id="calendar" label="Content Calendar" desc="Visualize your publishing schedule"        icon={ICONS.calendar} accentColor="#06b6d4"      onNavigate={onNavigate} />
                                <ToolCard id="gallery"  label="Asset Gallery"    desc="Browse and reuse AI-generated assets"      icon={ICONS.gallery}  accentColor="#8b5cf6"      onNavigate={onNavigate} />
                                <ToolCard id="upload"   label="Upload Center"    desc="Resize and push images to Supabase"        icon={ICONS.upload}   accentColor="#10b981"      onNavigate={onNavigate} />
                            </div>
                        </div>

                        {/* Intelligence section */}
                        <div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                marginBottom: 10,
                            }}>
                                <span style={{
                                    fontFamily: 'Space Grotesk',
                                    fontWeight: 800,
                                    fontSize: 11,
                                    letterSpacing: '0.1em',
                                    textTransform: 'uppercase',
                                    color: '#10b981',
                                }}>
                                    Intelligence
                                </span>
                                <div className="divider" style={{ flex: 1 }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                                <ToolCard id="trends"  label="Trend Monitor"  desc="Live Ohio insurance search trends"           icon={ICONS.trends}  accentColor="#10b981"      onNavigate={onNavigate} />
                                <ToolCard id="analyze" label="Image Analyzer" desc="AI analysis, alt text, insights"             icon={ICONS.analyze} accentColor="var(--blue)"  onNavigate={onNavigate} />
                                <ToolCard id="auditor" label="Content Audit"  desc="Dedupe check across ideas + schedule + live" icon={ICONS.audit}   accentColor="#f59e0b"      onNavigate={onNavigate} />
                            </div>
                        </div>
                    </div>

                    {/* Right: calendar + at-a-glance stats */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Calendar */}
                        <div className="card" style={{ padding: 16 }}>
                            <MiniCalendar />
                        </div>

                        {/* Today snapshot */}
                        <div className="card" style={{ padding: 16 }}>
                            <div style={{
                                fontFamily: 'Space Grotesk',
                                fontWeight: 700,
                                fontSize: 10,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'var(--text-muted)',
                                marginBottom: 12,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}>
                                <Icon d={ICONS.clock} size={12} />
                                Today's Publishing
                            </div>
                            {[
                                { time: '9:00 AM',  title: 'Check Blog Schedule',    status: 'pending',   color: '#f59e0b' },
                                { time: '11:00 AM', title: 'Review Scheduled Posts', status: 'pending',   color: '#f59e0b' },
                                { time: '2:00 PM',  title: 'Generate Weekly Images', status: 'todo',      color: 'var(--text-muted)' },
                                { time: '4:00 PM',  title: 'Audit Content Queue',    status: 'todo',      color: 'var(--text-muted)' },
                            ].map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 10,
                                    paddingBottom: i < 3 ? 10 : 0,
                                    marginBottom: i < 3 ? 10 : 0,
                                    borderBottom: i < 3 ? '1px solid var(--border)' : 'none',
                                }}>
                                    <span style={{
                                        fontFamily: 'JetBrains Mono',
                                        fontSize: 9,
                                        color: 'var(--text-muted)',
                                        whiteSpace: 'nowrap',
                                        marginTop: 2,
                                        minWidth: 52,
                                    }}>
                                        {item.time}
                                    </span>
                                    <span style={{
                                        fontSize: 11,
                                        color: 'var(--text-secondary)',
                                        lineHeight: 1.4,
                                        flex: 1,
                                    }}>
                                        {item.title}
                                    </span>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0, marginTop: 4 }} />
                                </div>
                            ))}
                        </div>

                        {/* Categories quick glance */}
                        <div className="card" style={{ padding: 16 }}>
                            <div style={{
                                fontFamily: 'Space Grotesk',
                                fontWeight: 700,
                                fontSize: 10,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'var(--text-muted)',
                                marginBottom: 12,
                            }}>
                                Blog Categories
                            </div>
                            {[
                                { label: 'Auto Insurance',     pct: 28, color: 'var(--red)' },
                                { label: 'Home Insurance',     pct: 34, color: 'var(--blue)' },
                                { label: 'Business Insurance', pct: 18, color: '#8b5cf6' },
                                { label: 'Life Insurance',     pct: 8,  color: '#f59e0b' },
                                { label: 'General Insurance',  pct: 12, color: '#10b981' },
                            ].map(cat => (
                                <div key={cat.label} style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>
                                            {cat.label}
                                        </span>
                                        <span style={{
                                            fontFamily: 'JetBrains Mono',
                                            fontSize: 9,
                                            color: cat.color,
                                            fontWeight: 600,
                                        }}>
                                            {cat.pct}%
                                        </span>
                                    </div>
                                    <div style={{
                                        height: 3,
                                        background: 'var(--border)',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${cat.pct}%`,
                                            background: cat.color,
                                            borderRadius: 2,
                                            transition: 'width 0.6s ease',
                                        }} />
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => onNavigate('auditor')}
                                className="btn btn-ghost"
                                style={{ width: '100%', justifyContent: 'center', marginTop: 8, fontSize: 10 }}
                            >
                                Full Content Audit
                            </button>
                        </div>

                        {/* System status */}
                        <div className="card" style={{ padding: 14 }}>
                            <div style={{
                                fontFamily: 'Space Grotesk',
                                fontWeight: 700,
                                fontSize: 10,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'var(--text-muted)',
                                marginBottom: 10,
                            }}>
                                System Status
                            </div>
                            {[
                                { label: 'Gemini AI',   status: 'Live',  color: '#22c55e' },
                                { label: 'Supabase',    status: 'Live',  color: '#22c55e' },
                                { label: 'Netlify CDN', status: 'Live',  color: '#22c55e' },
                                { label: 'Sheets Sync', status: 'Check', color: '#f59e0b' },
                            ].map(sys => (
                                <div key={sys.label} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 7,
                                }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sys.label}</span>
                                    <span style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        fontFamily: 'JetBrains Mono',
                                        fontSize: 9,
                                        fontWeight: 700,
                                        color: sys.color,
                                    }}>
                                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: sys.color }} />
                                        {sys.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{
                borderTop: '1px solid var(--border)',
                padding: '10px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                    Bradley Insurance Group · Canal Winchester, OH
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                    Gemini 2.5 · Supabase · Netlify
                </span>
            </div>
        </div>
    );
};

export default LandingPage;
