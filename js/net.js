// Online village client. Talks to server/index.js over WebSocket. Optional: the game is fully playable offline.
// The server URL comes from js/config.js, or ?mp=wss://… in the address bar (for testing / deploy previews).
import { MP_URL } from './config.js';

export function serverUrl() {
  try { const q = new URLSearchParams(location.search).get('mp'); if (q && /^wss?:\/\//.test(q)) return q; } catch { }
  return MP_URL || '';
}

// connect({ name, room, token, getPos, on }) → { emote, claimDaily, saveCloud, loadCloud, close, state }
// on: { status(s), welcome(m), players(list), emote(id, e), pos(x, z), claim(m), saved(m), cloud(m), error(code) }
export function connect({ url = serverUrl(), name, room = 'kampung', token = '', getPos, on = {} }) {
  const st = { status: 'connecting', id: null, players: new Map(), tries: 0, closed: false };
  let ws = null, sendT = null, last = '', resume = '';
  try { resume = sessionStorage.getItem('mk_resume') || ''; } catch { }
  const emit = (k, ...a) => { try { on[k] && on[k](...a); } catch (e) { console.warn(e); } };
  const setStatus = (s) => { st.status = s; emit('status', s); };
  const list = () => [...st.players.values()];
  const send = (m) => { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(m)); return true; } return false; };
  function open() {
    if (st.closed) return; setStatus(st.tries ? 'reconnecting' : 'connecting');
    try { ws = new WebSocket(url); } catch { return retry(); }
    ws.onopen = () => { const p = (getPos && getPos()) || { x: 0, z: 0 }; send({ t: 'hello', name, room, token: token || undefined, resume: resume || undefined, x: p.x, z: p.z }); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome') { st.id = m.id; st.tries = 0; resume = m.resume; try { sessionStorage.setItem('mk_resume', resume); } catch { } st.players = new Map(m.players.map(p => [p.id, p])); setStatus('online'); emit('welcome', m); emit('players', list()); }
      else if (m.t === 'join') { st.players.set(m.p.id, m.p); emit('players', list()); }
      else if (m.t === 'leave') { st.players.delete(m.id); emit('players', list()); }
      else if (m.t === 'moves') { for (const p of m.ps) if (p.id !== st.id) st.players.set(p.id, { ...st.players.get(p.id), ...p }); emit('players', list()); }
      else if (m.t === 'emote') emit('emote', m.id, m.e);
      else if (m.t === 'pos') emit('pos', m.x, m.z);
      else if (m.t === 'error') { emit('error', m.code); if (m.code === 'full' || m.code === 'auth') st.closed = true; }
      else if (m.t in on) emit(m.t, m);
    };
    ws.onclose = (e) => { clearInterval(sendT); if (e.code === 4009) st.closed = true; if (st.closed) return setStatus('offline'); retry(); };
    clearInterval(sendT); sendT = setInterval(() => { const p = getPos && getPos(); if (!p) return; const k = `${p.x},${p.z}`; if (k !== last && send({ t: 'move', x: p.x, z: p.z })) last = k; }, 200); // 5 Hz, only when moved
  }
  function retry() { if (st.closed) return; setStatus('reconnecting'); const wait = Math.min(15000, 1000 * 2 ** st.tries++); setTimeout(open, wait); }
  open();
  return {
    state: st,
    emote: (e) => send({ t: 'emote', e }),
    claimDaily: () => send({ t: 'claim', kind: 'daily' }),
    saveCloud: (data) => send({ t: 'save', data }),
    loadCloud: () => send({ t: 'load' }),
    close() { st.closed = true; clearInterval(sendT); try { sessionStorage.removeItem('mk_resume'); } catch { } if (ws) ws.close(); setStatus('offline'); },
  };
}
