import 'is-plain-object';
import 'shallow-clone';
import 'kind-of';
import 'for-own';

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/**
 * Launches a Puppeteer browser instance with stealth plugins and default sandbox bypass arguments.
 * Automatically injects proxy settings if process.env.PROXY_SERVER is configured.
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

  console.log('Launching local browser instance...');
  return puppeteer.launch({
    headless: true,
    args
  });
}
