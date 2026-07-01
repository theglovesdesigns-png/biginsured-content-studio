
import React, { ReactNode } from 'react';

interface PageShellProps {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    accentColor?: string;
    actions?: ReactNode;
    children: ReactNode;
    maxWidth?: number | string;
}

/**
 * PageShell — consistent inner-page wrapper used by every tool page.
 * Provides: top header bar with title + optional actions, content area.
 * IMPORTANT: This is purely visual wrapping — no functional logic lives here.
 */
const PageShell: React.FC<PageShellProps> = ({
    title,
    subtitle,
    icon,
    accentColor = 'var(--red)',
    actions,
    children,
    maxWidth = 960,
}) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* Top header */}
            <div className="top-header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {icon && (
                        <div style={{
                            width: 30,
                            height: 30,
                            borderRadius: 7,
                            background: accentColor + '20',
                            border: `1.5px solid ${accentColor}40`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: accentColor,
                            flexShrink: 0,
                        }}>
                            {icon}
                        </div>
                    )}
                    <div>
                        <div style={{
                            fontFamily: 'Space Grotesk',
                            fontWeight: 800,
                            fontSize: 14,
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.02em',
                            lineHeight: 1,
                        }}>
                            {title}
                        </div>
                        {subtitle && (
                            <div style={{
                                fontSize: 10,
                                color: 'var(--text-muted)',
                                fontWeight: 500,
                                marginTop: 2,
                            }}>
                                {subtitle}
                            </div>
                        )}
                    </div>
                </div>
                {actions && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {actions}
                    </div>
                )}
            </div>

            {/* Content area */}
            <div style={{
                flex: 1,
                padding: '24px',
                maxWidth: typeof maxWidth === 'number' ? maxWidth : maxWidth,
                width: '100%',
                alignSelf: 'center',
            }}>
                {children}
            </div>
        </div>
    );
};

export default PageShell;
