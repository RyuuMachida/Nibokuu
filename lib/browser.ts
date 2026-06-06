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
  const remoteUrl = process.env.REMOTE_BROWSER_URL || process.env.BROWSERLESS_URL;
  if (remoteUrl) {
    console.log(`Connecting to remote browser at: ${remoteUrl}`);
    return puppeteer.connect({
      browserWSEndpoint: remoteUrl
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
    throw new Error('Local Google Chrome / Chromium installation not found. Please install Chrome or configure REMOTE_BROWSER_URL.');
  }

  console.log(`Launching local browser from: ${executablePath}`);
  return puppeteer.launch({
    headless: true,
    executablePath,
    args
  });
}
