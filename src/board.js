// AIWANNA leaderboards (REST, promptVersion 2026-10-26). Two boards, one round = one run on each:
//   准度      accuracy of the round as the results screen shows it (88.2%), sent in hundredths of a percent (8820)
//   最大连击  the round's longest combo
// A round starts at 启程 / 再战 and settles only when the golden dragon is freed (a failed round is not submitted).
// Only inside the platform's player (an iframe on one of its origins); opened anywhere else the game just skips it.
// Nothing here may interrupt play: every failure is swallowed.
const ORIGINS = ['https://www.aiwanna.games', 'https://aiwanna.games', 'https://www.ai-made.games', 'https://ai-made.games', 'https://1gp-game-platform.vercel.app'];
const BOARDS = { accuracy: '74440ec2-4bc6-4aec-8404-6a7a92339ba3', combo: '4860c9d6-1ea2-40ff-bc4c-7ffd701c0b20' };

const embedded = (() => { try { return window.parent && window.parent !== window; } catch (e) { return false; } })();
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16);
}));
const wait = ms => new Promise(r => setTimeout(r, ms));

let session = null;      // { origin, token, expiresAt }
let asking = null;

function handshake() {
  if (asking) return asking;
  asking = new Promise(resolve => {
    const requestId = uuid();
    let timer = 0;
    const done = s => { removeEventListener('message', onMsg); clearTimeout(timer); asking = null; session = s; resolve(s); };
    const onMsg = e => {
      const d = e.data;
      if (e.source !== window.parent || !ORIGINS.includes(e.origin) || !d || d.source !== 'aimadegames-platform' || d.type !== 'leaderboard-session' || d.requestId !== requestId) return;
      if (d.session && d.session.token && d.apiOrigin === e.origin) done({ origin: e.origin, token: d.session.token, expiresAt: Date.parse(d.session.expiresAt) || 0 });
      else done(null);
    };
    addEventListener('message', onMsg);
    timer = setTimeout(() => done(null), 15000);
    for (const o of ORIGINS) { try { window.parent.postMessage({ source: 'aimadegames', type: 'leaderboard-session', requestId }, o); } catch (e) { /* not this origin */ } }
  });
  return asking;
}
async function auth(force) {
  if (!force && session && (!session.expiresAt || session.expiresAt - Date.now() > 30000)) return session;
  return handshake();
}

// one request with the platform's retry rules: same key and body every time, fresh token on 401, Retry-After on 429
async function call(path, key, body) {
  for (let k = 0, renewed = false; k < 4; k++) {
    const s = await auth(false); if (!s) return null;
    let r;
    try {
      r = await fetch(s.origin + path, {
        method: 'POST', credentials: 'omit',
        headers: { Authorization: 'Bearer ' + s.token, 'Idempotency-Key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) { await wait(1000 * (k + 1)); continue; }
    if (r.ok) return r.json().catch(() => ({}));
    if (r.status === 401 && !renewed) { renewed = true; session = null; await auth(true); continue; }
    if (r.status === 429) { await wait(Math.min(60, +(r.headers.get('Retry-After') || 5)) * 1000); continue; }
    if (r.status >= 500) { await wait(1000 * (k + 1)); continue; }
    return null;   // 4xx (already settled, expired run, out of range...): give up quietly
  }
  return null;
}

let round = null;

export const Board = {
  // a new round: open a run on every board (settlement waits for these, never borrows another round's run)
  start() {
    if (!embedded) return;
    const r = round = { runs: {}, settled: false };
    for (const [name, id] of Object.entries(BOARDS)) {
      const key = uuid();
      r.runs[name] = call(`/api/v1/leaderboards/${id}/runs`, key).then(j => (j && j.runId) || null).catch(() => null);
    }
  },
  // the dragon is freed: submit this round's accuracy (0..1) and longest combo, once
  async finish(accuracy, maxCombo) {
    const r = round; if (!r || r.settled) return null; r.settled = true;
    const scores = { accuracy: Math.max(0, Math.min(10000, Math.round(accuracy * 1000) * 10)), combo: Math.max(0, Math.round(maxCombo)) };
    const out = {};
    await Promise.all(Object.keys(BOARDS).map(async name => {
      try {
        const runId = await r.runs[name]; if (!runId) return;
        out[name] = await call(`/api/v1/runs/${runId}/score`, uuid(), { score: scores[name] });
      } catch (e) { /* skip */ }
    }));
    return out;
  },
  // a round that ends without the dragon freed is not submitted
  drop() { round = null; },
};
