import { build } from 'esbuild';
import fs from 'fs';
const r = await build({ entryPoints: ['test/dview.js'], bundle: true, minify: false, format: 'iife', write: false, target: ['es2020'], logLevel: 'warning' });
fs.writeFileSync('dist/dview.html', `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000;overflow:hidden}</style></head><body><script>${r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`);
console.log('view built');
