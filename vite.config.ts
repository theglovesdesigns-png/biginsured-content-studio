import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
        },
        plugins: [react()],
        define: {
            // NOTE: GEMINI_API_KEY is intentionally NOT injected here.
            // It lives only on the server, read by netlify/functions/gemini-proxy.ts.
            // Injecting it here would bundle it into the public JS and trigger
            // Netlify's secret scanner (and be a real security issue).
            'process.env.SUPABASE_URL':   JSON.stringify(env.SUPABASE_URL || ''),
            'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || ''),
            'process.env.GOOGLE_SHEETS_WEBHOOK_URL': JSON.stringify(env.GOOGLE_SHEETS_WEBHOOK_URL || ''),
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            }
        }
    };
});
