// 키보드 + 마우스 드래그 + 터치(왼쪽 가상 조이스틱 / 오른쪽 시점 회전)
export const input = { x: 0, y: 0, run: false, yaw: 0, pitch: 0.42, dist: 7 };
const keys = new Set();

function recompute() {
  if (input.joy) return;
  const k = (...n) => n.some((c) => keys.has(c));
  input.x = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
  input.y = (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0);
  input.run = k('ShiftLeft', 'ShiftRight');
}

export function attachControls(el, joyBase, joyKnob) {
  const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  const down = (e) => { if (typing()) return; keys.add(e.code); recompute(); };
  const up = (e) => { keys.delete(e.code); recompute(); };
  const blur = () => { keys.clear(); recompute(); };
  const tick = setInterval(() => {
    if (typing()) return;
    if (keys.has('KeyQ')) input.yaw += 0.04;
    if (keys.has('KeyE')) input.yaw -= 0.04;
  }, 16);
  window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);

  let joyId = null, joyO = null, lookId = null, last = null;
  const R = 55;
  const pd = (e) => {
    if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.5) {
      if (joyId !== null) return;
      joyId = e.pointerId; joyO = { x: e.clientX, y: e.clientY };
      input.joy = true;
      joyBase.style.display = 'block'; joyBase.style.left = e.clientX - R + 'px'; joyBase.style.top = e.clientY - R + 'px';
      joyKnob.style.transform = 'translate(0px,0px)';
    } else {
      if (lookId !== null) return;
      lookId = e.pointerId; last = { x: e.clientX, y: e.clientY };
    }
    el.setPointerCapture?.(e.pointerId);
  };
  const pm = (e) => {
    if (e.pointerId === joyId) {
      let dx = e.clientX - joyO.x, dy = e.clientY - joyO.y;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
      joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
      const m = Math.min(1, Math.hypot(dx, dy) / R);
      const dead = m < 0.12 ? 0 : m;
      const a = Math.atan2(dx, -dy);
      input.x = Math.sin(a) * dead; input.y = Math.cos(a) * dead; input.run = false;
    } else if (e.pointerId === lookId) {
      input.yaw -= (e.clientX - last.x) * 0.006;
      input.pitch = Math.max(0.05, Math.min(1.1, input.pitch + (e.clientY - last.y) * 0.004));
      last = { x: e.clientX, y: e.clientY };
    }
  };
  const pu = (e) => {
    if (e.pointerId === joyId) { joyId = null; input.joy = false; input.x = 0; input.y = 0; joyBase.style.display = 'none'; recompute(); }
    if (e.pointerId === lookId) lookId = null;
  };
  const wheel = (e) => { input.dist = Math.max(3.5, Math.min(12, input.dist + e.deltaY * 0.01)); };
  el.addEventListener('pointerdown', pd); el.addEventListener('pointermove', pm);
  el.addEventListener('pointerup', pu); el.addEventListener('pointercancel', pu);
  el.addEventListener('wheel', wheel, { passive: true });
  return () => {
    clearInterval(tick);
    window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur);
    el.removeEventListener('pointerdown', pd); el.removeEventListener('pointermove', pm);
    el.removeEventListener('pointerup', pu); el.removeEventListener('pointercancel', pu);
    el.removeEventListener('wheel', wheel);
  };
}
