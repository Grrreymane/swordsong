# Analyse candidate tracks for the rhythm engine: tempo grid, downbeat, key (pentatonic), accents, loudness.
# usage: python3 tools/analyze.py file1 [file2 ...]  -> prints a JSON summary per file
import sys, json, numpy as np, librosa, soundfile as sf, warnings
warnings.filterwarnings('ignore')
PENT = np.array([0, 2, 4, 7, 9])  # major pentatonic

def grid_fit(beats):
    i = np.arange(len(beats)); A = np.vstack([np.ones_like(i), i]).T
    (a, T), *_ = np.linalg.lstsq(A, beats, rcond=None)
    res = beats - (a + T * i)
    return a, T, float(np.sqrt(np.mean(res ** 2)) * 1000), float(np.max(np.abs(res)) * 1000)

def analyse(path):
    y, sr = librosa.load(path, sr=22050, mono=True)
    dur = len(y) / sr
    oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=256)
    tempo, beats = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=256, units='time', tightness=200)
    tempo = float(np.atleast_1d(tempo)[0])
    out = {'file': path, 'dur': round(dur, 2), 'librosa_bpm': round(tempo, 2), 'nbeats': len(beats)}
    if len(beats) < 16: out['note'] = 'too few beats'; return out
    a, T, rms_ms, max_ms = grid_fit(np.array(beats))
    out.update(bpm_fit=round(60 / T, 3), grid_rms_ms=round(rms_ms, 1), grid_max_ms=round(max_ms, 1))
    # refine tempo and phase to ~1 ms on a fine onset envelope (librosa's beat times are frame-quantised)
    yf, srf = librosa.load(path, sr=44100, mono=True)
    hop = 64
    fenv = librosa.onset.onset_strength(y=yf, sr=srf, hop_length=hop, n_fft=1024)
    fenv = fenv / (fenv.max() + 1e-9)
    n_b = int((dur - a) / T)
    def score(a_, T_):
        idx = np.round((a_ + T_ * np.arange(n_b)) * srf / hop).astype(int); idx = idx[(idx >= 0) & (idx < len(fenv))]
        return float(fenv[idx].sum())
    best = (score(a, T), a, T)
    for dT in np.linspace(-0.004, 0.004, 41):
        for da in np.arange(-0.04, 0.0405, 0.002):
            sc = score(a + da, T * (1 + dT))
            if sc > best[0]: best = (sc, a + da, T * (1 + dT))
    _, a0, T0 = best
    for da in np.arange(-0.003, 0.0031, 0.0005):
        sc = score(a0 + da, T0)
        if sc > best[0]: best = (sc, a0 + da, T0)
    _, a, T = best
    # a fresh sharp onset peaks a few ms after the attack begins; nudge to the rising edge
    out.update(bpm=round(60 / T, 4), grid_a=round(a, 4))
    # low-band onset strength (drums / bass plucks) sampled on the fitted grid
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=256))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    low = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S[freqs < 250]), sr=sr, hop_length=256)
    full = oenv
    def at(env, t): i = int(round(t * sr / 256)); return float(env[max(0, min(len(env) - 1, i))]) if i < len(env) else 0.0
    n = int((dur - a) / T)
    grid = a + T * np.arange(n)
    lowv = np.array([max(at(low, t + d) for d in (-0.02, 0, 0.02)) for t in grid])
    fullv = np.array([max(at(full, t + d) for d in (-0.02, 0, 0.02)) for t in grid])
    # downbeat phase: strongest low-band hits + chroma change on the bar line
    C = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)
    def chroma_at(t): i = int(t * sr / 512); return C[:, max(0, min(C.shape[1] - 1, i))]
    nov = np.array([np.linalg.norm(chroma_at(t + T * 0.5) - chroma_at(t - T * 0.5)) for t in grid])
    score = [float(np.mean(lowv[p::4]) / (np.mean(lowv) + 1e-9) + 0.5 * np.mean(nov[p::4]) / (np.mean(nov) + 1e-9)) for p in range(4)]
    ph = int(np.argmax(score))
    first_db = grid[ph]
    while first_db - 4 * T > -0.02: first_db -= 4 * T   # earliest downbeat on the grid (may be a pickup before it)
    if first_db < 0: first_db += 4 * T
    out.update(downbeat_phase=ph, phase_scores=[round(x, 2) for x in score], offset=round(float(first_db), 4))
    bars = int((dur - first_db) / (4 * T))
    out['bars'] = bars
    # pentatonic key: best rotation of the major pentatonic set
    cm = C.mean(axis=1); best = max(range(12), key=lambda r: cm[(PENT + r) % 12].sum())
    names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
    tr = (best - 2 + 6) % 12 - 6   # ladder is D major pentatonic
    frac = float(cm[(PENT + best) % 12].sum() / cm.sum())
    out.update(pent_root=names[best], transpose=tr, pent_fit=round(frac, 3))
    # accents per beat from the first downbeat (0..9)
    g2 = first_db + T * np.arange(bars * 4)
    lv = np.array([max(at(low, t + d) for d in (-0.02, 0, 0.02)) for t in g2])
    lv = lv / (np.percentile(lv, 97) + 1e-9)
    out['acc'] = ''.join(str(int(min(9, max(0, round(v * 9))))) for v in lv)
    # energy per bar (rms) to plan sections
    rms = librosa.feature.rms(y=y, hop_length=512)[0]
    eb = []
    for b in range(bars):
        i0 = int((first_db + b * 4 * T) * sr / 512); i1 = int((first_db + (b + 1) * 4 * T) * sr / 512)
        eb.append(float(np.mean(rms[i0:i1])) if i1 > i0 else 0)
    eb = np.array(eb); out['energy'] = ''.join(str(int(min(9, round(v / (eb.max() + 1e-9) * 9)))) for v in eb)
    # loudness (stereo file, original rate)
    x, sr0 = sf.read(path, always_2d=True)
    r = np.sqrt(np.mean(x ** 2)); out['rms_db'] = round(20 * np.log10(r + 1e-12), 1); out['peak'] = round(float(np.abs(x).max()), 3)
    return out

if __name__ == '__main__':
    for f in sys.argv[1:]:
        try: print(json.dumps(analyse(f), ensure_ascii=False))
        except Exception as e: print(json.dumps({'file': f, 'error': str(e)}))
