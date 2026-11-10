// 고요사 서버: WebSocket(접속자 위치, 연등, 돌탑) + 빌드된 정적 파일 서빙
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { MAX_PLAYERS, LANTERN_SLOTS, CAIRNS, COURT, MAX_WISH } from '../shared/path.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const PORT = Number(process.env.PORT || 8787);

// ---------- 영속 상태 ----------
let state = { counter: 0, lanterns: [], cairns: CAIRNS.map(() => 0) };
try {
  const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  if (raw && Array.isArray(raw.lanterns) && Array.isArray(raw.cairns)) {
    state = {
      counter: Number(raw.counter) || 0,
      lanterns: raw.lanterns.slice(0, LANTERN_SLOTS),
      cairns: CAIRNS.map((_, i) => Number(raw.cairns[i]) || 0),
    };
  }
} catch { /* 첫 실행 */ }

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = STATE_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state));
      fs.renameSync(tmp, STATE_FILE);
    } catch (e) { console.error('상태 저장 실패', e.message); }
  }, 2000);
}
function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch { /* ignore */ }
}

// ---------- HTTP (정적 파일) ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.map': 'application/json',
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200); res.end('ok'); return; }
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  let file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('빌드가 필요해요: npm run build'); return; }
  const ext = path.extname(file);
  const cache = file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': cache });
  fs.createReadStream(file).pipe(res);
});

// ---------- WebSocket ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws') { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

const players = new Map(); // id -> {ws, x, z, r, lastLantern, lastStone}
let nextId = 1;
let dirty = false;

const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const broadcast = (obj) => { const m = JSON.stringify(obj); for (const p of players.values()) if (p.ws.readyState === 1) p.ws.send(m); };
const num = (v, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);

wss.on('connection', (ws) => {
  if (players.size >= MAX_PLAYERS) { send(ws, { t: 'full' }); ws.close(); return; }
  const id = nextId++;
  const me = { ws, x: 0, z: 100, r: 0, lastLantern: 0, lastStone: 0, alive: true };
  players.set(id, me);
  send(ws, { t: 'init', id, lanterns: state.lanterns.filter(Boolean), cairns: state.cairns, count: players.size });
  broadcast({ t: 'count', n: players.size });
  dirty = true;

  ws.on('pong', () => { me.alive = true; });
  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(data.toString()); } catch { return; }
    const now = Date.now();
    if (m.t === 'pos') {
      const x = num(m.x, -200, 200), z = num(m.z, -250, 200), r = num(m.r, -7, 7);
      if (x === null || z === null || r === null) return;
      me.x = x; me.z = z; me.r = r; dirty = true;
    } else if (m.t === 'lantern') {
      if (now - me.lastLantern < 8000) { send(ws, { t: 'notice', msg: '연등은 조금 있다가 다시 달 수 있어요.' }); return; }
      if (Math.hypot(me.x - COURT.x, me.z - COURT.z) > COURT.r + 10) { send(ws, { t: 'notice', msg: '연등은 절 마당에서 달 수 있어요.' }); return; }
      me.lastLantern = now;
      const wish = String(m.wish ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, MAX_WISH);
      const color = Math.max(0, Math.min(4, Math.floor(Number(m.color) || 0)));
      const slot = (state.counter * 37) % LANTERN_SLOTS; // 37과 96은 서로소 → 마당 전체에 고르게 퍼짐
      state.counter++;
      const item = { slot, color, wish, ts: now };
      state.lanterns[slot] = item;
      broadcast({ t: 'lantern', item });
      scheduleSave();
    } else if (m.t === 'stone') {
      const c = Math.floor(Number(m.cairn));
      const cairn = CAIRNS[c];
      if (!cairn) return;
      if (now - me.lastStone < 1500) return;
      if (Math.hypot(me.x - cairn.x, me.z - cairn.z) > 9) { send(ws, { t: 'notice', msg: '돌탑 가까이 가서 얹어 주세요.' }); return; }
      me.lastStone = now;
      state.cairns[c] = Math.min(99999, state.cairns[c] + 1);
      broadcast({ t: 'stone', cairn: c, n: state.cairns[c] });
      scheduleSave();
    }
  });
  ws.on('close', () => {
    players.delete(id);
    broadcast({ t: 'leave', id });
    broadcast({ t: 'count', n: players.size });
  });
  ws.on('error', () => {});
});

// 위치 브로드캐스트 10Hz
setInterval(() => {
  if (!dirty) return;
  dirty = false;
  const p = [];
  for (const [id, v] of players) p.push([id, +v.x.toFixed(2), +v.z.toFixed(2), +v.r.toFixed(2)]);
  broadcast({ t: 'players', p });
}, 100);

// 끊긴 연결 정리
setInterval(() => {
  for (const [id, p] of players) {
    if (!p.alive) { p.ws.terminate(); players.delete(id); continue; }
    p.alive = false;
    if (p.ws.readyState === 1) p.ws.ping();
  }
}, 20000);

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flushSave(); process.exit(0); });
server.listen(PORT, () => console.log(`고요사 서버 http://localhost:${PORT}  (ws: /ws, 데이터: ${STATE_FILE})`));
