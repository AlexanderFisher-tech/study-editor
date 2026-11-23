import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const MAX_GZIP_BYTES = 40 * 1024; // 40 KB combined JS + CSS budget

const jsPath = resolve(process.cwd(), 'dist/study-editor.min.js');
const cssPath = resolve(process.cwd(), 'dist/study-editor.min.css');

const jsBuf = readFileSync(jsPath);
const cssBuf = readFileSync(cssPath);

const jsGzip = gzipSync(jsBuf, { level: 9 }).length;
const cssGzip = gzipSync(cssBuf, { level: 9 }).length;
const totalGzip = jsGzip + cssGzip;

const jsText = jsBuf.toString('utf8');

// Check for forbidden browser blocking dialogs (window.alert / window.confirm)
const forbiddenPatterns = [
  /\bwindow\.alert\s*\(/,
  /\bwindow\.confirm\s*\(/,
  /(?<![.\w$])alert\s*\(/,
  /(?<![.\w$])confirm\s*\(/,
];

for (const pattern of forbiddenPatterns) {
  if (pattern.test(jsText)) {
    console.error(`FAIL: Forbidden blocking dialog call matched ${pattern} in dist/study-editor.min.js`);
    process.exit(1);
  }
}

console.log(
  `Bundle metrics: JS=${(jsBuf.length / 1024).toFixed(2)} KB (${(jsGzip / 1024).toFixed(2)} KB gzip), ` +
    `CSS=${(cssBuf.length / 1024).toFixed(2)} KB (${(cssGzip / 1024).toFixed(2)} KB gzip), ` +
    `Total gzip=${(totalGzip / 1024).toFixed(2)} KB / 40.00 KB`,
);

if (totalGzip > MAX_GZIP_BYTES) {
  console.error(
    `FAIL: Combined gzipped bundle (${totalGzip} bytes) exceeds 40 KB limit (${MAX_GZIP_BYTES} bytes).`,
  );
  process.exit(1);
}

console.log('PASS: Bundle size and dialog policy verified.');
