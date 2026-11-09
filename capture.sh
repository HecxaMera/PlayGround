#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"
: "${CAPTURE_URL:?CAPTURE_URL must be set}"
: "${CAPTURE_DIR:?CAPTURE_DIR must be set}"
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p node --input-type=module <<'NODE'
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const project = process.cwd();
const url = process.env.CAPTURE_URL;
const output = resolve(process.env.CAPTURE_DIR);
const relativeOutput = relative(project, output);
let target;
try { target = new URL(url); } catch {}
if (!target || !/^https?:$/.test(target.protocol)) {
  console.error('CAPTURE_URL must be an absolute HTTP(S) URL.');
  process.exitCode = 1;
} else if (relativeOutput === '' || relativeOutput === '..' || (!relativeOutput.startsWith('..' + sep) && !relativeOutput.startsWith(sep))) {
  console.error('CAPTURE_DIR must be outside the project source directory.');
  process.exitCode = 1;
} else {
  const runtime = join(process.env.HOME, '.local/share/omgithub-playwright');
  let browser;
  let exitCode = 1;
  try {
    const require = createRequire(join(runtime, 'package.json'));
    const { chromium } = require('playwright');
    const config = JSON.parse(readFileSync(join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json'), 'utf8'));
    if (process.platform === 'linux') process.env.DISPLAY ||= ':' + readFileSync(join(runtime, 'display'), 'utf8').trim();
    mkdirSync(output, { recursive: true });
    browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 });
    for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.setDefaultTimeout(30000);
      const failures = [];
      page.on('pageerror', error => failures.push(error.message));
      page.on('response', response => {
        if (response.status() >= 400 && new URL(response.url()).origin === new URL(url).origin) {
          failures.push(`HTTP ${response.status()}: ${response.url()}`);
        }
      });
      let response;
      try {
        response = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
      } catch (error) {
        error.exitCode = 75;
        throw error;
      }
      if (!response?.ok()) {
        const status = response?.status();
        const temporary = !response || [408, 429, 500, 502, 503, 504].includes(status) || status >= 500;
        const error = new Error(`HTTP ${status ?? 'no response'} loading ${url}`);
        error.exitCode = temporary ? 75 : 1;
        throw error;
      }
      await page.locator('body').waitFor({ state: 'visible' });
      await page.locator('#fish-count').waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.fonts.status === 'loaded', { timeout: 30000 });
      await page.waitForTimeout(1200);
      const rendered = await page.locator('#ocean').evaluate(canvas => ({
        width: canvas.width,
        height: canvas.height,
        webgl: Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
      }));
      if (!rendered.webgl || rendered.width < 100 || rendered.height < 100) {
        throw new Error(`The ocean scene did not render (${JSON.stringify(rendered)}).`);
      }
      if (failures.length) throw new Error(`Page rendering failed: ${failures.join('; ')}`);
      try {
        await page.screenshot({ path: join(output, `final-${name}.png`), timeout: 30000 });
      } catch (error) {
        if (error.name === 'TimeoutError' || !browser.isConnected()) error.exitCode = 75;
        throw error;
      }
      await page.close();
      console.log(`Captured ${name} (${width}x${height}) from ${url}`);
    }
    exitCode = 0;
  } catch (error) {
    console.error(error);
    exitCode = error.exitCode || (error.code === 'MODULE_NOT_FOUND' ? 75 : 1);
  } finally {
    try {
      await browser?.close();
    } catch (error) {
      console.error(`Browser cleanup failed: ${error.message}`);
      if (exitCode === 0) exitCode = 75;
    }
  }
  process.exitCode = exitCode;
}
NODE
