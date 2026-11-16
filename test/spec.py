import sys, numpy as np, wave
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
f = wave.open(sys.argv[1]); sr = f.getframerate(); n = f.getnframes()
x = np.frombuffer(f.readframes(n), dtype=np.int16).reshape(-1, 2).astype(np.float32).mean(axis=1) / 32768
fig, ax = plt.subplots(2, 1, figsize=(16, 7), gridspec_kw={'height_ratios': [1, 3]})
t = np.arange(len(x)) / sr
ax[0].plot(t[::50], x[::50], lw=0.3); ax[0].set_xlim(0, t[-1]); ax[0].set_ylim(-1, 1)
ax[1].specgram(x, NFFT=2048, Fs=sr, noverlap=1536, cmap='magma', vmin=-110, vmax=-20)
ax[1].set_yscale('symlog', linthresh=200); ax[1].set_ylim(30, 16000)
for m in sys.argv[3:]:
    for a in ax: a.axvline(float(m), color='c', lw=0.8)
plt.tight_layout(); plt.savefig(sys.argv[2], dpi=70)
