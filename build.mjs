import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

// node build.mjs [entry] [--single]
//   dist/index.html            : the game; loads its music from dist/music/*.mp3
//   dist/swordsong-single.html : (--single) one self-contained file with the music inlined as base64
const entry = process.argv.slice(2).find(a => !a.startsWith('--')) || 'src/main.js';
const r = await build({
  entryPoints: [entry], bundle: true, minify: true, format: 'iife', write: false,
  target: ['es2020', 'safari15'], legalComments: 'none', logLevel: 'warning',
});
let js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const page = fs.readFileSync('src/index.html', 'utf8');
const html = page.replace('/*__BUNDLE__*/', () => js);
fs.writeFileSync('dist/index.html', html);
console.log('built', (html.length / 1024).toFixed(1) + ' KB');
if (process.argv.includes('--single')) {
  const music = {};
  for (const f of fs.readdirSync('dist/music').filter(f => f.endsWith('.mp3')).sort())
    music['music/' + f] = fs.readFileSync(path.join('dist/music', f)).toString('base64');
  const single = page.replace('/*__BUNDLE__*/', () => 'window.__MUSIC=' + JSON.stringify(music) + ';\n' + js);
  fs.writeFileSync('dist/swordsong-single.html', single);
  console.log('built single file', (single.length / 1024 / 1024).toFixed(1) + ' MB');
}
