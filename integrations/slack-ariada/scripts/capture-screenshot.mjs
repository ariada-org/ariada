import { access, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const report = new URL('../test-report/result.html', import.meta.url);
const screenshot = new URL('../test-report/slack-ariada-screenshot.png', import.meta.url);

await access(chrome);
await access(report);

await new Promise((resolve, reject) => {
  const child = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--window-size=1440,1200',
    `--screenshot=${screenshot.pathname}`,
    report.href,
  ], { stdio: 'inherit' });
  child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Chrome exited ${code}`))));
});

const info = await stat(screenshot);
if (info.size < 10_000) {
  throw new Error(`screenshot too small: ${info.size} bytes`);
}

console.log(`screenshot=${screenshot.pathname}`);
console.log(`screenshot-bytes=${info.size}`);
