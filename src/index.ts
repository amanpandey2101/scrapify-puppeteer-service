import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Store active browser sessions
const browserSessions = new Map<string, { browser: Browser; page: Page }>();

// Random user agents to avoid detection
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// Function to get random user agent
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Function to set up stealth mode for page
async function setupStealthMode(page: Page): Promise<void> {
  // Set random user agent
  await page.setUserAgent(getRandomUserAgent());

  // Set viewport to common screen resolution
  await page.setViewport({
    width: 1366 + Math.floor(Math.random() * 200),
    height: 768 + Math.floor(Math.random() * 200),
  });

  // Override webdriver detection
  await page.evaluateOnNewDocument(() => {
    // Remove webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Mock chrome property
    (window as any).chrome = {
      runtime: {},
    };

    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission } as any) :
        originalQuery(parameters)
    );
  });

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeSessions: browserSessions.size
  });
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
      const existing = browserSessions.get(sessionId)!;
      try {
        await existing.browser.close();
      } catch (e) {
        console.warn('Error closing existing browser:', e);
      }
      browserSessions.delete(sessionId);
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-client-side-phishing-detection',
        '--disable-sync',
        '--disable-default-apps',
        '--no-default-browser-check',
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-back-forward-cache',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--disable-prompt-on-repost',
        '--disable-hang-monitor',
        '--disable-features=Translate',
        '--disable-popup-blocking',
        '--disable-component-update'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = await browser.newPage();
    
    // Setup stealth mode
    await setupStealthMode(page);

    // Navigate with retries
    let retries = 3;
    while (retries > 0) {
      try {
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    browserSessions.set(sessionId, { browser, page });

    res.json({ 
      success: true, 
      message: 'Browser launched successfully',
      sessionId 
    });
  } catch (error: any) {
    console.error('Launch browser error:', error);
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

    // Add random delay to avoid detection
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

    // Navigate with retries
    let retries = 3;
    while (retries > 0) {
      try {
        await session.page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    res.json({ success: true, message: 'Navigation successful' });
  } catch (error: any) {
    console.error('Navigate error:', error);
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
  } catch (error: any) {
    console.error('Get page HTML error:', error);
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

    // Wait for element and add human-like delay
    await session.page.waitForSelector(selector, { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Scroll to element first
    await session.page.evaluate((sel: string) => {
      const element = document.querySelector(sel);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, selector);

    await new Promise(resolve => setTimeout(resolve, 500));
    await session.page.click(selector);
    
    res.json({ success: true, message: 'Element clicked successfully' });
  } catch (error: any) {
    console.error('Click element error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fill input
app.post('/fill-input', async (req, res) => {
  try {
    const { sessionId, selector, value } = req.body;
    
    if (!sessionId || !selector || value === undefined) {
      return res.status(400).json({ error: 'sessionId, selector, and value are required' });
    }

    const session = browserSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await session.page.waitForSelector(selector, { timeout: 10000 });
    
    // Clear existing text and add human-like typing
    await session.page.click(selector, { clickCount: 3 });
    await session.page.keyboard.press('Backspace');
    
    // Type with random delays between characters
    for (const char of value) {
      await session.page.keyboard.type(char);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    }
    
    res.json({ success: true, message: 'Input filled successfully' });
  } catch (error: any) {
    console.error('Fill input error:', error);
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
  } catch (error: any) {
    console.error('Wait for element error:', error);
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

    await session.page.waitForSelector(selector, { timeout: 10000 });
    await session.page.evaluate((sel: string) => {
      const element = document.querySelector(sel);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, selector);
    
    // Add delay after scrolling
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    res.json({ success: true, message: 'Scrolled to element' });
  } catch (error: any) {
    console.error('Scroll to element error:', error);
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

    await session.page.waitForSelector(selector, { timeout: 10000 });
    const text = await session.page.$eval(selector, (el) => el.textContent?.trim() || '');
    
    res.json({ text });
  } catch (error: any) {
    console.error('Extract text error:', error);
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
  } catch (error: any) {
    console.error('Close session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cleanup function with timeout for idle sessions
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of browserSessions.entries()) {
    // Close sessions older than 30 minutes
    const sessionAge = now - parseInt(sessionId.split('_')[1]);
    if (sessionAge > 30 * 60 * 1000) {
      session.browser.close().catch(console.error);
      browserSessions.delete(sessionId);
      console.log(`Cleaned up idle session: ${sessionId}`);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  for (const [sessionId, session] of Array.from(browserSessions.entries())) {
    try {
      await session.browser.close();
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
    }
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down...');
  for (const [sessionId, session] of Array.from(browserSessions.entries())) {
    try {
      await session.browser.close();
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
    }
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Puppeteer service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 