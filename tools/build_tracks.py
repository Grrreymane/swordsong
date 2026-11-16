# Cut, encode and describe the chosen tracks for the game.
# usage: python3 tools/build_tracks.py tools/tracks.config.json
# config: { "slots": { "<slot>": { "file": "...", "from": 0, "bars": 24, "loop": [0, 24] | null, "gain_db": 0, "alias": "<slot>" } }, "credits": [...] }
import sys, json, subprocess, numpy as np, soundfile as sf, os, importlib.util
spec = importlib.util.spec_from_file_location('an', os.path.join(os.path.dirname(__file__), 'analyze.py')); an = importlib.util.module_from_spec(spec); spec.loader.exec_module(an)
SR = 44100
cfg = json.load(open(sys.argv[1]))
os.makedirs('dist/music', exist_ok=True)
for f in os.listdir('dist/music'):
    if f.endswith('.mp3'): os.remove(os.path.join('dist/music', f))
out, cache = [], {}
def clean_attack(mono, sr, lo, hi):
    """first sharp attack after quiet in [lo, hi): returns (index, threshold)"""
    pk = mono[lo:hi].max()
    for frac in (0.5, 0.35, 0.25):
        th = frac * pk
        i = lo + int(0.15 * sr)
        while i < hi:
            j = i + int(np.argmax(mono[i:hi] >= th)) if (mono[i:hi] >= th).any() else hi
            if j >= hi: break
            if mono[max(0, j - int(0.15 * sr)): j].max() < 0.45 * th: return j, th
            i = j + int(0.05 * sr)
    j = lo + int(np.argmax(mono[lo:hi] >= 0.5 * pk)); return j, 0.5 * pk

for slot, c in cfg['slots'].items():
    if 'alias' in c: out.append({'slot': slot, 'alias': c['alias']}); continue
    f = c['file']
    if f not in cache: cache[f] = an.analyse(f)
    A = cache[f]
    x, sr = sf.read(f, always_2d=True)
    if sr != SR:
        import librosa; x = np.stack([librosa.resample(np.ascontiguousarray(x[:, k]), orig_sr=sr, target_sr=SR) for k in range(x.shape[1])], 1); sr = SR
    if x.shape[1] == 1: x = np.repeat(x, 2, 1)
    off = c.get('offset', A['offset'])
    if c.get('loop_all'):
        # the whole file is one seamless loop: its exact length fixes the tempo
        L = len(x) / SR; nb = int(round(L / (4 * 60 / A['bpm'])))
        bpm = nb * 4 * 60 / L; BAR = 4 * 60 / bpm
        pad0 = int(0.5 * SR); pad1 = int((off + 1.0) * SR)
        seg = np.vstack([x[-pad0:], x, x[:pad1]])
        bar0 = pad0 / SR + off; loop = [0, nb]; fb = 0
    else:
        bpm = c.get('bpm', A['bpm']); BAR = 4 * 60 / bpm
        fb = c.get('from', 0); nb = c.get('bars', A['bars'] - fb)
        pre = 0.06 if fb > 0 else min(off, 0.25)
        s0 = int(round((off + fb * BAR - pre) * SR)); s1 = int(round((off + (fb + nb) * BAR) * SR))
        tail = int(c.get('tail', 2.5) * SR)
        seg = x[max(0, s0): min(len(x), s1 + tail)].copy()
        if s0 < 0: seg = np.vstack([np.zeros((-s0, 2)), seg])
        if fb > 0: seg[: int(pre * SR)] *= np.linspace(0, 1, int(pre * SR))[:, None]
        if tail > 0 and s1 + tail < len(x): seg[-tail:] *= np.linspace(1, 0, tail)[:, None]
        bar0 = pre; loop = c.get('loop')
    tmp = f'/tmp/cut_{slot}.wav'; sf.write(tmp, seg.astype(np.float32), SR, subtype='FLOAT')
    mp3 = f'dist/music/{slot}.mp3'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', str(c.get('kbps', 128)) + 'k', '-ar', str(SR), mp3], check=True)
    # alignment fingerprint: a 0.6 s amplitude envelope (2 ms windows) at the most "peaky" spot in the first bars.
    # The page cross-correlates it with the decoded audio to undo whatever padding its MP3 decoder kept.
    mono = np.abs(seg).max(1); Wn = int(0.002 * SR); N = 300
    def envelope(sig, a, n): return np.array([sig[a + k * Wn: a + (k + 1) * Wn].max() for k in range(n)])
    lo = int(bar0 * SR); hi = min(len(mono) - N * Wn - 1, lo + int(8 * BAR * SR))
    bestv, bestp = -1, lo
    for p in range(lo, max(lo + 1, hi), int(0.05 * SR)):
        e = envelope(mono, p, N); v = float(np.std(e) / (np.mean(e) + 1e-9))
        if v > bestv: bestv, bestp = v, p
    e = envelope(mono, bestp, N); q = np.clip(np.round(e / e.max() * 61), 0, 61).astype(int)
    ALPH = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    mark = {'t': round(bestp / SR, 5), 'w': 0.002, 'env': ''.join(ALPH[v] for v in q)}
    def find(sig):   # same correlation as the page does
        L = 75; a = bestp - L * Wn; ee = envelope(sig, a, N + 2 * L); ref = q / 61.0
        r = (ref - ref.mean()) / (ref.std() + 1e-9); best = (-9, 0)
        sc = []
        for lag in range(-L, L + 1):
            w = ee[lag + L: lag + L + N]; c = float(np.dot(r, (w - w.mean()) / (w.std() + 1e-9))); sc.append(c)
        k = int(np.argmax(sc)); fr = 0
        if 0 < k < len(sc) - 1: y0, y1, y2 = sc[k - 1], sc[k], sc[k + 1]; fr = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2 + 1e-12)
        return (k - L + fr) * Wn / SR
    dec = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', mp3, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
    d = np.abs(np.frombuffer(dec, np.float32).reshape(-1, 2)).max(1)
    sh_dec = find(d)
    d2 = np.concatenate([np.zeros(1634), d]); sh_pad = find(d2)   # pretend a decoder kept 1634 samples of padding
    b0 = fb * 4
    acc = '' if c.get('free') else (A['acc'] * 3)[b0: b0 + nb * 4]
    gain = 10 ** ((c.get('target_db', -16) - A['rms_db'] + c.get('gain_db', 0)) / 20)
    gain = min(gain, 0.98 / max(1e-3, float(np.abs(seg).max())))   # never push a peak past full scale
    m = {'slot': slot, 'url': f'music/{slot}.mp3', 'bpm': round(bpm, 5), 'offset': round(bar0, 5), 'bars': nb,
         'loop': loop, 'mark': mark, 'gain': round(float(min(1.6, max(0.15, gain))), 3),
         'transpose': c.get('transpose', A['transpose']), 'acc': acc}
    if c.get('free'): m['free'] = True
    out.append(m)
    print(f"{slot:7s} {os.path.basename(f)[:28]:28s} bpm {bpm:9.4f} bars {fb}+{nb} loop {loop} key {A['pent_root']}({m['transpose']:+d}) grid_rms {A['grid_rms_ms']}ms "
          f"mark {mark['t']:.3f}s ffmpeg {sh_dec * 1000:+.2f}ms padded {sh_pad * 1000:+.2f}ms (expect +37.05) size {os.path.getsize(mp3) // 1024}KB gain {m['gain']}")
src = '// generated by tools/build_tracks.py\n'
src += 'export const TRACKS = ' + json.dumps(out, ensure_ascii=False) + ';\n'
src += 'export const CREDITS = ' + json.dumps(cfg.get('credits', []), ensure_ascii=False) + ';\n'
open('src/tracks.js', 'w').write(src)
