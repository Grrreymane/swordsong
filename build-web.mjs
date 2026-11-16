// npm run build:web -> web/ : only what the game needs at runtime (index.html + music/), for AIWANNA hosting.
// Uses writeFileSync(readFileSync()) so every file gets a fresh mtime (copyFileSync keeps the old one on Windows).
import fs from 'fs';
fs.rmSync('web', { recursive: true, force: true });
fs.mkdirSync('web/music', { recursive: true });
fs.writeFileSync('web/index.html', fs.readFileSync('dist/index.html'));
for (const f of fs.readdirSync('dist/music').filter(f => f.endsWith('.mp3')))
  fs.writeFileSync('web/music/' + f, fs.readFileSync('dist/music/' + f));
console.log('web/ ready:', fs.readdirSync('web/music').length, 'tracks');
