// 프레임마다 바뀌는 값은 React 상태가 아니라 이 모듈의 가변 객체로 공유한다.
export const me = { x: 0, z: 100, y: 0, r: 0, moving: false, s: 0, dPath: 0, inCourt: false };
export const world = { phase: 0.25, night: 0, override: null, started: false };
export const remote = new Map(); // id -> {x,z,r,tx,tz,tr,moving}
