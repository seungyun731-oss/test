import { me, remote } from './store.js';

let ws = null, retry = 0, posTimer = null, closed = false;
let H = {};
export const net = { id: null, connected: false };

export function connect(handlers) {
  H = handlers; closed = false; open();
  return () => { closed = true; clearInterval(posTimer); ws?.close(); };
}

function open() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.onopen = () => {
    retry = 0; net.connected = true; H.onStatus?.(true);
    clearInterval(posTimer);
    let lx = NaN, lz = NaN, lt = 0;
    posTimer = setInterval(() => {
      const now = performance.now();
      if (ws.readyState !== 1) return;
      if (Math.abs(me.x - lx) > 0.02 || Math.abs(me.z - lz) > 0.02 || now - lt > 1500) {
        lx = me.x; lz = me.z; lt = now;
        ws.send(JSON.stringify({ t: 'pos', x: +me.x.toFixed(2), z: +me.z.toFixed(2), r: +me.r.toFixed(2) }));
      }
    }, 100);
  };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    switch (m.t) {
      case 'init': net.id = m.id; H.onInit?.(m); break;
      case 'players': {
        const seen = new Set();
        for (const [id, x, z, r] of m.p) {
          if (id === net.id) continue;
          seen.add(id);
          let p = remote.get(id);
          if (!p) { p = { x, z, r, tx: x, tz: z, tr: r, moving: false }; remote.set(id, p); H.onRoster?.(); }
          p.moving = Math.hypot(x - p.tx, z - p.tz) > 0.01;
          p.tx = x; p.tz = z; p.tr = r;
          if (m.p.length > 0 && Math.hypot(p.x - x, p.z - z) > 30) { p.x = x; p.z = z; }
          seen.add(id);
        }
        let removed = false;
        for (const id of [...remote.keys()]) if (!seen.has(id)) { remote.delete(id); removed = true; }
        if (removed) H.onRoster?.();
        break;
      }
      case 'leave': if (remote.delete(m.id)) H.onRoster?.(); break;
      case 'count': H.onCount?.(m.n); break;
      case 'lantern': H.onLantern?.(m.item); break;
      case 'stone': H.onStone?.(m); break;
      case 'notice': H.onNotice?.(m.msg); break;
      case 'full': closed = true; H.onFull?.(); break;
      default: break;
    }
  };
  ws.onclose = () => {
    net.connected = false; H.onStatus?.(false);
    remote.clear(); H.onRoster?.();
    clearInterval(posTimer);
    if (closed) return;
    retry = Math.min(retry + 1, 6);
    setTimeout(open, 800 * 2 ** retry);
  };
  ws.onerror = () => ws.close();
}

const send = (o) => { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(o)); return true; } return false; };
export const sendLantern = (wish, color) => send({ t: 'lantern', wish, color });
export const sendStone = (cairn) => send({ t: 'stone', cairn });
