import puppeteer, { Browser } from 'puppeteer-core';
import * as fs from 'fs';
import * as os from 'os';

function getLocalChromePath(): string {
  const platform = os.platform();
  if (platform === 'win32') {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === 'darwin') {
    const p = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(p)) return p;
  } else {
    const paths = ['/usr/bin/google-chrome', '/usr/bin/chromium-browser'];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return '';
}

/**
 * Launches a Puppeteer browser instance using puppeteer-core.
 * Connects to remote Browserless.io in production, or launches local Chrome in development.
 */
export async function launchBrowser(): Promise<Browser> {
  const browserlessUrl = process.env.BROWSERLESS_URL;

  if (browserlessUrl) {
    console.log(`[Browserless] Connecting to: ${browserlessUrl}`);
    return puppeteer.connect({
      browserWSEndpoint: browserlessUrl
    });
  }

  const args = ['--no-sandbox', '--disable-setuid-sandbox'];

  if (process.env.PROXY_SERVER) {
    console.log(`Configuring browser proxy-server: ${process.env.PROXY_SERVER}`);
    args.push(`--proxy-server=${process.env.PROXY_SERVER}`);
  }

  const executablePath = getLocalChromePath();
  if (!executablePath) {
    throw new Error('Local Google Chrome / Chromium installation not found. Please install Chrome or configure BROWSERLESS_URL.');
  }

  console.log(`Launching local browser from: ${executablePath}`);
  return puppeteer.launch({
    headless: true,
    executablePath,
    args
  });
}

/**
 * Unified HTML Scraper Helper
 * 1. Tries Termux HTTP Scraper first (0 Browserless units used, 100% reliable over any tunnel).
 * 2. If Termux is offline / fails, gracefully falls back to Browserless Puppeteer.
 */
export async function scrapeHtml(targetUrl: string, waitSelector?: string): Promise<{ html: string; source: string }> {
  const termuxUrl = process.env.TERMUX_SERVER_URL;

  // 1. Try Termux HTTP Scraper
  if (termuxUrl) {
    try {
      const cleanTermuxUrl = termuxUrl.replace(/\/$/, '');
      console.log(`[Switcher] Trying Termux HTTP scraper at: ${cleanTermuxUrl} for ${targetUrl}`);
      
      const res = await fetch(`${cleanTermuxUrl}/scrape?url=${encodeURIComponent(targetUrl)}`, {
        method: 'GET',
        signal: AbortSignal.timeout(35000)
      });

      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && json.html) {
          console.log(`[Switcher] Scrape SUCCEEDED via Termux HP (${json.duration_ms}ms)! 0 Browserless units consumed.`);
          return { html: json.html, source: 'termux' };
        }
      }
      console.warn(`[Switcher] Termux returned status ${res.status}. Falling back to Browserless...`);
    } catch (err: any) {
      console.warn(`[Switcher] Termux scrape failed (${err.message}). Falling back to Browserless...`);
    }
  }

  // 2. Fallback to Browserless / Local Browser
  console.log(`[Switcher] Launching Browserless fallback for: ${targetUrl}`);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    
    if (waitSelector) {
      await page.waitForFunction(
        (sel) => !!document.querySelector(sel),
        { timeout: 15000 },
        waitSelector
      ).catch(() => {});
    }

    const html = await page.content();
    await browser.close();
    return { html, source: process.env.BROWSERLESS_URL ? 'browserless' : 'local' };
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}
