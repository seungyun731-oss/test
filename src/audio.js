// 외부 음원 없이 WebAudio로 합성하는 산사의 소리 (라이선스 걱정 없음)
let ctx = null, master = null, noiseBuf = null;
let wind, stream, cricket, muted = false;
const g = { windGain: null, streamGain: null, cricketGain: null };
let nextChime = 0, nextBird = 0;

function makeNoise() {
  const len = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = w * 0.5 + last * 3; }
  return buf;
}
function noiseSrc() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(); return s; }

export function startAudio() {
  if (ctx) { ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
  noiseBuf = makeNoise();

  // 바람
  const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 520; wf.Q.value = 0.5;
  g.windGain = ctx.createGain(); g.windGain.gain.value = 0.18;
  noiseSrc().connect(wf); wf.connect(g.windGain); g.windGain.connect(master);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.08;
  lfo.connect(lfoG); lfoG.connect(g.windGain.gain); lfo.start();

  // 계곡물
  const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1700; sf.Q.value = 0.7;
  const sh = ctx.createBiquadFilter(); sh.type = 'highpass'; sh.frequency.value = 600;
  g.streamGain = ctx.createGain(); g.streamGain.gain.value = 0;
  noiseSrc().connect(sf); sf.connect(sh); sh.connect(g.streamGain); g.streamGain.connect(master);

  // 밤 풀벌레
  const co = ctx.createOscillator(); co.frequency.value = 4300;
  const cm = ctx.createGain(); cm.gain.value = 0;
  const cl = ctx.createOscillator(); cl.type = 'square'; cl.frequency.value = 22;
  const clg = ctx.createGain(); clg.gain.value = 0.5;
  const clo = ctx.createGain(); clo.gain.value = 0.5;
  cl.connect(clg); clg.connect(cm.gain); clo.connect(cm.gain);
  const slow = ctx.createOscillator(); slow.frequency.value = 0.7;
  const slowG = ctx.createGain(); slowG.gain.value = 0.35;
  slow.connect(slowG); slowG.connect(clo.gain);
  g.cricketGain = ctx.createGain(); g.cricketGain.gain.value = 0;
  co.connect(cm); cm.connect(g.cricketGain); g.cricketGain.connect(master);
  co.start(); cl.start(); slow.start();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.1);
}
export const isMuted = () => muted;

function tone({ f, type = 'sine', vol = 0.1, attack = 0.005, decay = 1, when = 0, bendTo }) {
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (bendTo) o.frequency.exponentialRampToValueAtTime(bendTo, t + decay);
  const a = ctx.createGain();
  a.gain.setValueAtTime(0.0001, t);
  a.gain.exponentialRampToValueAtTime(vol, t + attack);
  a.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(a); a.connect(master);
  o.start(t); o.stop(t + decay + 0.05);
}

/** 범종: 비정수배음 + 긴 여운 */
export function bell(vol = 0.3) {
  if (!ctx) return;
  const base = 98;
  [[1, 1, 9], [2.0, 0.6, 7], [2.76, 0.5, 5.5], [4.07, 0.28, 4], [5.43, 0.2, 3], [6.8, 0.1, 2]].forEach(([m, v, d]) =>
    tone({ f: base * m, vol: vol * v, attack: 0.012, decay: d }));
}
/** 목탁: 짧고 나무 같은 소리 */
export function moktak(count = 12, vol = 0.18) {
  if (!ctx) return;
  for (let i = 0; i < count; i++) {
    const when = i * 0.52 + (i % 4 === 3 ? 0.12 : 0);
    tone({ f: 620, bendTo: 410, type: 'triangle', vol, attack: 0.002, decay: 0.16, when });
    tone({ f: 1240, bendTo: 800, type: 'sine', vol: vol * 0.3, attack: 0.002, decay: 0.08, when });
  }
}
/** 풍경 */
function chime(v) {
  const f = 1800 + Math.random() * 900;
  tone({ f, vol: 0.05 * v, decay: 3 });
  tone({ f: f * 2.71, vol: 0.02 * v, decay: 1.6 });
}
function bird(v) {
  const f = 2600 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) tone({ f, bendTo: f * (1.1 + Math.random() * 0.4), vol: 0.035 * v, attack: 0.01, decay: 0.12, when: i * 0.16 });
}
export function footstep(stone) {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 1.2;
  const f = ctx.createBiquadFilter(); f.type = stone ? 'bandpass' : 'lowpass'; f.frequency.value = stone ? 1400 : 650; f.Q.value = stone ? 1.2 : 0.4;
  const a = ctx.createGain(); const t = ctx.currentTime;
  a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(stone ? 0.07 : 0.1, t + 0.01); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  s.connect(f); f.connect(a); a.connect(master);
  s.start(t, Math.random() * 2, 0.2);
}
export function pop() { if (ctx) { tone({ f: 523, vol: 0.08, decay: 0.5 }); tone({ f: 784, vol: 0.05, decay: 0.8, when: 0.08 }); } }
export function clack() { if (ctx) tone({ f: 210, bendTo: 120, type: 'triangle', vol: 0.18, attack: 0.002, decay: 0.18 }); }

/** 매 프레임: 환경음 볼륨 갱신. progress 0..1, court 0..1(마당 근접), night 0..1 */
export function updateAudio(dt, { progress, court, night }) {
  if (!ctx) return;
  const t = ctx.currentTime;
  g.windGain.gain.setTargetAtTime(0.1 + 0.1 * progress, t, 0.5);
  g.streamGain.gain.setTargetAtTime(0.12 * Math.max(0, 1 - progress * 1.6) * (1 - court), t, 0.5);
  g.cricketGain.gain.setTargetAtTime(0.012 * night * (1 - court * 0.6), t, 0.8);
  nextChime -= dt; nextBird -= dt;
  if (nextChime <= 0) { nextChime = 2.5 + Math.random() * 6; if (court > 0.05 || progress > 0.8) chime(0.3 + court); }
  if (nextBird <= 0) { nextBird = 3 + Math.random() * 7; if (night < 0.4) bird(1 - night); }
}
