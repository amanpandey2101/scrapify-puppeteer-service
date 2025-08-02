"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const puppeteer_1 = __importDefault(require("puppeteer"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
// Store active browser sessions
const browserSessions = new Map();
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Launch browser
app.post('/launch-browser', async (req, res) => {
    try {
        const { sessionId, url } = req.body;
        if (!sessionId || !url) {
            return res.status(400).json({ error: 'sessionId and url are required' });
        }
        // Close existing session if exists
        if (browserSessions.has(sessionId)) {
            const existing = browserSessions.get(sessionId);
            await existing.browser.close();
            browserSessions.delete(sessionId);
        }
        const browser = await puppeteer_1.default.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });
        browserSessions.set(sessionId, { browser, page });
        res.json({
            success: true,
            message: 'Browser launched successfully',
            sessionId
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Navigate to URL
app.post('/navigate', async (req, res) => {
    try {
        const { sessionId, url } = req.body;
        if (!sessionId || !url) {
            return res.status(400).json({ error: 'sessionId and url are required' });
        }
        const session = browserSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        await session.page.goto(url, { waitUntil: 'networkidle2' });
        res.json({ success: true, message: 'Navigation successful' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get page HTML
app.get('/page-html/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = browserSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        const html = await session.page.content();
        res.json({ html });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Click element
app.post('/click-element', async (req, res) => {
    try {
        const { sessionId, selector } = req.body;
        if (!sessionId || !selector) {
            return res.status(400).json({ error: 'sessionId and selector are required' });
        }
        const session = browserSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        await session.page.waitForSelector(selector);
        await session.page.click(selector);
        res.json({ success: true, message: 'Element clicked successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Fill input
app.post('/fill-input', async (req, res) => {
    try {
        const { sessionId, selector, value } = req.body;
        if (!sessionId || !selector || !value) {
            return res.status(400).json({ error: 'sessionId, selector, and value are required' });
        }
        const session = browserSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        await session.page.waitForSelector(selector);
        await session.page.type(selector, value);
        res.json({ success: true, message: 'Input filled successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Wait for element
app.post('/wait-for-element', async (req, res) => {
    try {
        const { sessionId, selector, timeout = 30000 } = req.body;
        if (!sessionId || !selector) {
            return res.status(400).json({ error: 'sessionId and selector are required' });
        }
        const session = browserSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        await session.page.waitForSelector(selector, { timeout });
        res.json({ success: true, message: 'Element found' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Scroll to element
app.post('/scroll-to-element', async (req, res) => {
    try {
        const { sessionId, selector } = req.body;
        if (!sessionId || !selector) {
            return res.status(400).json({ error: 'sessionId and selector are required' });
        }
        const session = browserSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        await session.page.waitForSelector(selector);
        await session.page.evaluate((sel) => {
            const element = document.querySelector(sel);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }, selector);
        res.json({ success: true, message: 'Scrolled to element' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Extract text from element
app.post('/extract-text', async (req, res) => {
    try {
        const { sessionId, selector } = req.body;
        if (!sessionId || !selector) {
            return res.status(400).json({ error: 'sessionId and selector are required' });
        }
        const session = browserSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        await session.page.waitForSelector(selector);
        const text = await session.page.$eval(selector, (el) => el.textContent || '');
        res.json({ text });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Close browser session
app.delete('/close-session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = browserSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        await session.browser.close();
        browserSessions.delete(sessionId);
        res.json({ success: true, message: 'Session closed' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Cleanup function
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    for (const [sessionId, session] of Array.from(browserSessions.entries())) {
        try {
            await session.browser.close();
        }
        catch (error) {
            console.error(`Error closing session ${sessionId}:`, error);
        }
    }
    process.exit(0);
});
app.listen(PORT, () => {
    console.log(`Puppeteer service running on port ${PORT}`);
});
