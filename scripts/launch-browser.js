// scripts/launch-browser.js
// Opens the dashboard in a real (non-headless) Chromium window on the
// virtual display (:99, started by Xvfb in the workflow) so ffmpeg's
// x11grab can capture it as the video source for the YouTube stream.

const puppeteer = require('puppeteer');

const URL = process.env.DASHBOARD_URL || 'http://localhost:8080/index.html';
const WIDTH = 1920;
const HEIGHT = 1080;

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: puppeteer.executablePath(),
    args: [
      '--kiosk',
      `--window-size=${WIDTH},${HEIGHT}`,
      '--window-position=0,0',
      '--disable-infobars',
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-dev-shm-usage',
      '--disable-gpu-shader-disk-cache',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    defaultViewport: null,
  });

  const [page] = await browser.pages();
  await page.setViewport({ width: WIDTH, height: HEIGHT });

  const goto = async () => {
    try {
      await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
      console.log('Dashboard loaded:', URL);
    } catch (err) {
      console.error('Failed to load dashboard, retrying in 5s:', err.message);
      setTimeout(goto, 5000);
    }
  };
  await goto();

  // If the tab ever crashes, reopen it rather than leaving a black screen.
  page.on('close', async () => {
    console.warn('Page closed, relaunching...');
    const [p2] = await browser.pages();
    if (p2) await p2.goto(URL).catch(() => {});
  });

  // Keep the process alive; the workflow step controls the overall duration.
  await new Promise(() => {});
})();
