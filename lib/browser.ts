import puppeteer from 'puppeteer-core';
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
export async function launchBrowser() {
  const termuxUrl = process.env.TERMUX_SERVER_URL; // e.g. http://192.168.x.x:3000
  const browserlessUrl = process.env.BROWSERLESS_URL;

  // 1. Try Termux Server first if configured
  if (termuxUrl) {
    try {
      console.log(`Checking Termux server at: ${termuxUrl}`);
      // Use standard fetch available in Node 18+
      const res = await fetch(`${termuxUrl.replace(/\/$/, '')}/endpoint`, { 
        method: 'GET',
        // short timeout so it doesn't hang if Termux is offline
        signal: AbortSignal.timeout(3000) 
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.wsEndpoint) {
          console.log(`Connecting to Termux browser at: ${data.wsEndpoint}`);
          return await puppeteer.connect({ browserWSEndpoint: data.wsEndpoint });
        }
      }
      console.log(`Termux server didn't return a valid endpoint. Falling back...`);
    } catch (e) {
      const err = e as Error;
      console.log(`Failed to connect to Termux server (${err.message}). Falling back...`);
    }
  }

  // 2. Fallback to Browserless URL
  if (browserlessUrl) {
    console.log(`Connecting to remote browser at: ${browserlessUrl}`);
    return puppeteer.connect({
      browserWSEndpoint: browserlessUrl
    });
  }

  const args = ['--no-sandbox', '--disable-setuid-sandbox'];

  // Conditionally add proxy server argument if configured in environment variables
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
