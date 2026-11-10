import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import Terrain from './world/Terrain.jsx';
import Scenery from './world/Scenery.jsx';
import Temple from './world/Temple.jsx';
import Sky from './world/Sky.jsx';
import Lanterns, { LANTERN_COLORS, slotPos } from './world/Lanterns.jsx';
import Cairn from './world/Cairn.jsx';
import { LocalPlayer, Remotes } from './world/Players.jsx';
import { attachControls, input } from './controls.js';
import { connect, sendLantern, sendStone } from './net.js';
import { me, remote, world } from './store.js';
import { COURT, CAIRNS, PATH_LENGTH, MAX_PLAYERS, MAX_WISH } from '../shared/path.js';
import { PRESETS } from './time.js';
import { startAudio, setMuted, updateAudio, bell, moktak, pop, clack } from './audio.js';

/** 환경음 갱신 + 해질녘 범종 / 새벽 목탁 (모두 같은 시각에 울린다) */
function AudioLoop() {
  const prev = useRef(null);
  useFrame((_, dt) => {
    if (!world.started) return;
    const court = Math.max(0, Math.min(1, 1 - (Math.hypot(me.x - COURT.x, me.z - COURT.z) - COURT.r) / 40));
    updateAudio(Math.min(dt, 0.1), { progress: Math.min(1, me.s / PATH_LENGTH), court, night: world.night });
    const p = world.phase;
    if (world.override === null && prev.current !== null) {
      if (prev.current < 0.52 && p >= 0.52 && p - prev.current < 0.05) {
        const v = 0.2 + 0.3 * court;
        bell(v); setTimeout(() => bell(v), 9000); setTimeout(() => bell(v), 18000);
      }
      if (p < prev.current - 0.5) moktak(14, 0.1 + 0.12 * court);
    }
    prev.current = p;
  });
  return null;
}

const timeName = (p) => (p < 0.08 || p >= 0.9 ? '새벽' : p < 0.45 ? '낮' : p < 0.62 ? '저녁' : '밤');

export default function App() {
  const wrapRef = useRef(), baseRef = useRef(), knobRef = useRef();
  const [started, setStarted] = useState(false);
  const [lanterns, setLanterns] = useState([]);
  const [cairns, setCairns] = useState(() => CAIRNS.map(() => 0));
  const [count, setCount] = useState(1);
  const [connected, setConnected] = useState(false);
  const [full, setFull] = useState(false);
  const [ids, setIds] = useState([]);
  const [toast, setToast] = useState('');
  const [hud, setHud] = useState({ s: 0, inCourt: false, cairn: -1, wish: '', tname: '낮' });
  const [modal, setModal] = useState(false);
  const [wish, setWish] = useState('');
  const [color, setColor] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [timeIdx, setTimeIdx] = useState(() => {
    const q = new URLSearchParams(location.search).get('time');
    const i = PRESETS.findIndex((t) => t.key === q);
    if (i > 0) world.override = PRESETS[i].phase;
    return Math.max(0, i);
  });
  const lanternsRef = useRef([]);
  const toastT = useRef();

  const say = useCallback((m) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 3200); }, []);

  useEffect(() => connect({
    onStatus: setConnected,
    onInit: (m) => {
      const arr = []; for (const it of m.lanterns) arr[it.slot] = it;
      lanternsRef.current = arr; setLanterns(arr); setCairns(m.cairns); setCount(m.count);
    },
    onRoster: () => setIds([...remote.keys()]),
    onCount: setCount,
    onLantern: (item) => { const a = [...lanternsRef.current]; a[item.slot] = item; lanternsRef.current = a; setLanterns(a); },
    onStone: ({ cairn, n }) => setCairns((c) => c.map((v, i) => (i === cairn ? n : v))),
    onNotice: say,
    onFull: () => setFull(true),
  }), [say]);

  useEffect(() => attachControls(wrapRef.current, baseRef.current, knobRef.current), []);

  // HUD 폴링 (프레임 값 → React 상태, 4Hz)
  useEffect(() => {
    const t = setInterval(() => {
      let cairn = -1;
      CAIRNS.forEach((c, i) => { if (Math.hypot(me.x - c.x, me.z - c.z) < 5) cairn = i; });
      let w = '';
      if (me.inCourt && me.y > 20) {
        let best = 4.5;
        for (const it of lanternsRef.current) {
          if (!it || !it.wish) continue;
          const p = slotPos(it.slot);
          const d = Math.hypot(me.x - p.x, me.z - p.z);
          if (d < best) { best = d; w = it.wish; }
        }
      }
      setHud((h) => {
        const s = Math.round(me.s), tname = timeName(world.phase);
        if (h.s === s && h.inCourt === me.inCourt && h.cairn === cairn && h.wish === w && h.tname === tname) return h;
        return { s, inCourt: me.inCourt, cairn, wish: w, tname };
      });
    }, 250);
    return () => clearInterval(t);
  }, []);

  const enter = () => { world.started = true; startAudio(); setStarted(true); };
  const toggleMute = () => { setMuted(!muted); setMutedState(!muted); };
  const cycleTime = () => {
    const n = (timeIdx + 1) % PRESETS.length;
    setTimeIdx(n);
    world.override = PRESETS[n].phase ?? null;
    say(`시간: ${PRESETS[n].label}`);
  };
  const lightLantern = () => {
    if (sendLantern(wish, color)) { pop(); say('연등을 달았어요. 모두의 마당에 오래 걸려 있을 거예요.'); setModal(false); setWish(''); }
    else say('연결이 끊겼어요. 잠시 후 다시 시도해 주세요.');
  };
  const addStone = () => { if (sendStone(hud.cairn)) clack(); else say('연결이 끊겼어요.'); };

  const remain = Math.max(0, Math.round(PATH_LENGTH - hud.s));
  const prog = Math.min(1, hud.s / PATH_LENGTH);
  const tpreset = PRESETS[timeIdx];

  return (
    <div className="app">
      <div className="canvas-wrap" ref={wrapRef}>
        <Canvas dpr={[1, 1.75]} camera={{ fov: 60, near: 0.3, far: 520, position: [0, 5, 110] }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
          <Sky />
          <Terrain />
          <Scenery />
          <Temple />
          <Lanterns items={lanterns} />
          {CAIRNS.map((c, i) => <Cairn key={i} x={c.x} z={c.z} count={cairns[i]} />)}
          <LocalPlayer />
          <Remotes ids={ids} />
          <AudioLoop />
        </Canvas>
      </div>

      <div className="joy-base" ref={baseRef}><div className="joy-knob" ref={knobRef} /></div>

      {started && (
        <div className="hud">
          <div className="top">
            <div className="chip" title="지금 함께 있는 사람">🧑‍🤝‍🧑 {count}/{MAX_PLAYERS}{connected ? '' : ' · 연결 중…'}</div>
            <div className="progress">
              <div className="plabel">{hud.inCourt ? '🏯 고요사 마당에 도착했어요' : `대웅전까지 ${remain}m`}</div>
              <div className="bar"><div className="fill" style={{ width: `${prog * 100}%` }} /><div className="dot" style={{ left: `${prog * 100}%` }} /></div>
            </div>
            <div className="chips">
              <button className="chip btn" onClick={cycleTime} aria-label="시간 바꾸기">{tpreset.key === 'auto' ? `🧭 ${hud.tname}` : `${tpreset.icon} ${tpreset.label}`}</button>
              <button className="chip btn" onClick={toggleMute} aria-label="소리">{muted ? '🔇' : '🔊'}</button>
            </div>
          </div>

          {hud.wish && <div className="wish">🏮 “{hud.wish}”</div>}
          {toast && <div className="toast">{toast}</div>}

          <div className="actions">
            {hud.cairn >= 0 && (
              <button className="act" onClick={addStone}>🪨 돌 하나 얹기<small>{CAIRNS[hud.cairn].name} · {cairns[hud.cairn]}개</small></button>
            )}
            {hud.inCourt && <button className="act" onClick={() => setModal(true)}>🏮 연등 달기<small>마당 연등 {lanterns.filter(Boolean).length}개</small></button>}
          </div>
        </div>
      )}

      {modal && (
        <div className="modal" onPointerDown={(e) => e.stopPropagation()}>
          <div className="card">
            <h2>연등 달기</h2>
            <p>마음에 둔 바람을 한 줄 남겨 보세요. (선택 · {MAX_WISH}자)</p>
            <input value={wish} maxLength={MAX_WISH} placeholder="예: 모두 평안하길" onChange={(e) => setWish(e.target.value)} autoFocus />
            <div className="colors">
              {LANTERN_COLORS.map((c, i) => <button key={c} className={i === color ? 'sw on' : 'sw'} style={{ background: c }} onClick={() => setColor(i)} aria-label={`색 ${i + 1}`} />)}
            </div>
            <div className="row">
              <button className="ghost" onClick={() => setModal(false)}>닫기</button>
              <button className="primary" onClick={lightLantern}>달기</button>
            </div>
            <small>소원은 다른 방문자에게 공개돼요. 개인정보는 적지 마세요.</small>
          </div>
        </div>
      )}

      {full && <div className="overlay"><div className="intro"><h1>산사가 가득 찼어요</h1><p>지금은 {MAX_PLAYERS}명이 함께 걷고 있어요.<br />잠시 후 다시 들러 주세요.</p></div></div>}

      {!started && !full && (
        <div className="overlay">
          <div className="intro">
            <div className="lantern">🏮</div>
            <h1>고요사 가는 길</h1>
            <p className="lead">말 없이 걷고, 연등 하나 달고,<br />돌 하나 얹고 가세요.</p>
            <button className="primary big" onClick={enter}>산길 들어서기</button>
            <ul>
              <li>🎧 소리를 켜고, 가능하면 이어폰으로</li>
              <li>🖥️ <b>PC</b> W A S D 걷기 · 드래그로 시점 · Shift 빨리 걷기</li>
              <li>📱 <b>모바일</b> 왼쪽 화면 조이스틱 · 오른쪽 화면 드래그로 시점</li>
              <li>🔔 해질녘엔 범종이 울려요 (산사의 하루는 20분)</li>
            </ul>
            <small>{connected ? `지금 ${count}명이 함께 있어요` : '산사에 연결하는 중…'}</small>
          </div>
        </div>
      )}
    </div>
  );
}
export { input };
