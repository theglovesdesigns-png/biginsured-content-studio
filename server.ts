import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FEEDBACK_FILE = path.join(__dirname, 'feedback_data.json');

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    // API Routes
    app.get('/api/feedback', async (req, res) => {
        try {
            const data = await fs.readFile(FEEDBACK_FILE, 'utf-8');
            res.json(JSON.parse(data));
        } catch (error) {
            res.json([]);
        }
    });

    app.post('/api/feedback', async (req, res) => {
        try {
            let existing = [];
            try {
                const data = await fs.readFile(FEEDBACK_FILE, 'utf-8');
                existing = JSON.parse(data);
            } catch (e) {
                // File doesn't exist yet
            }

            const newFeedback = {
                ...req.body,
                timestamp: Date.now()
            };

            // Keep last 500 feedbacks
            const updated = [newFeedback, ...existing].slice(0, 500);
            await fs.writeFile(FEEDBACK_FILE, JSON.stringify(updated, null, 2));
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error saving feedback:', error);
            res.status(500).json({ error: 'Failed to save feedback' });
        }
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        // Serve static files in production
        app.use(express.static(path.join(__dirname, 'dist')));
        app.get('*all', (req, res) => {
            res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
