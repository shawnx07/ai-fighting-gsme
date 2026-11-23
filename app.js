if (window.__ashenStop) window.__ashenStop();
(function () {
'use strict';
// Shared constants and move data. Heights: h = high (ducks), m = mid, l = low.
const W = 960, H = 540, FLOOR = 470, GRAV = 0.85, WALL_L = 70, WALL_R = 890, MAXHP = 180;
const BTN = { '1': 'lp', '2': 'rp', '3': 'lk', '4': 'rk' };
const BTNS = ['lp', 'rp', 'lk', 'rk'];
const M = (o) => Object.assign({ a: 2, hh: 20, p: 6, pb: 4, hs: 14, bs: 10, stance: 'stand', mv: 0 }, o);

// s = startup, a = active, r = recovery, d = damage, hs = hit stun, bs = block stun,
// p / pb = pushback on hit / block, rc = reach, hy = hit height, c = string follow-ups, cr = frame the string may continue
const MOVES = {
  '1':     M({ n: 'Jab', h: 'h', s: 10, r: 10, d: 6, hs: 14, bs: 10, p: 6, rc: 74, hy: 112, lim: 'lp', c: { '2': '1,2' }, cr: 14 }),
  '1,2':   M({ n: 'Jab, Cross', h: 'h', s: 12, r: 14, d: 8, hs: 17, bs: 12, p: 9, pb: 6, rc: 82, hy: 112, lim: 'rp', c: { '3': '1,2,3' }, cr: 19 }),
  '1,2,3': M({ n: 'Jab, Cross, Kick', h: 'm', s: 13, a: 3, r: 24, d: 14, hs: 20, bs: 15, p: 16, pb: 11, rc: 92, hy: 88, lim: 'lk' }),
  '2':     M({ n: 'Straight', h: 'h', s: 12, r: 13, d: 9, hs: 15, bs: 11, p: 9, pb: 6, rc: 84, hy: 112, lim: 'rp' }),
  '3':     M({ n: 'Mid Kick', h: 'm', s: 13, a: 3, r: 17, d: 10, hs: 16, bs: 12, p: 10, pb: 7, rc: 92, hy: 86, lim: 'lk', c: { '4': '3,4' }, cr: 20 }),
  '3,4':   M({ n: 'Kick Combo', h: 'h', s: 14, a: 3, r: 26, d: 15, hs: 21, bs: 16, p: 16, pb: 11, rc: 96, hy: 122, lim: 'rk' }),
  '4':     M({ n: 'Roundhouse', h: 'h', s: 16, a: 3, r: 26, d: 16, hs: 20, bs: 14, p: 18, pb: 12, rc: 100, hy: 124, lim: 'rk' }),
  'f+2':   M({ n: 'Hook', h: 'm', s: 15, a: 3, r: 20, d: 13, hs: 18, bs: 14, p: 14, pb: 10, rc: 86, hy: 108, lim: 'rp', mv: 2.2 }),
  'f+3':   M({ n: 'Thrust Kick', h: 'm', s: 16, a: 3, r: 19, d: 11, hs: 17, bs: 13, p: 24, pb: 15, rc: 106, hy: 82, lim: 'lk' }),
  'df+1':  M({ n: 'Mid Jab', h: 'm', s: 11, r: 12, d: 7, hs: 14, bs: 11, p: 7, pb: 5, rc: 74, hy: 100, lim: 'lp' }),
  'df+2':  M({ n: 'Launcher', h: 'm', s: 16, a: 3, r: 22, d: 16, hs: 30, bs: 18, p: 0, pb: 12, rc: 84, hy: 100, lim: 'rp', la: 1 }),
  'd+1':   M({ n: 'Low Jab', h: 'l', s: 10, r: 12, d: 5, hs: 13, bs: 12, p: 5, rc: 72, hy: 34, lim: 'lp', stance: 'crouch' }),
  'd+2':   M({ n: 'Crouch Hook', h: 'm', s: 12, r: 15, d: 8, hs: 15, bs: 11, p: 8, pb: 6, rc: 80, hy: 84, lim: 'rp', stance: 'crouch' }),
  'd+3':   M({ n: 'Low Kick', h: 'l', s: 12, a: 3, r: 17, d: 7, hs: 14, bs: 15, p: 7, rc: 88, hy: 26, lim: 'lk', stance: 'crouch' }),
  'd+4':   M({ n: 'Sweep', h: 'l', s: 16, a: 4, r: 32, d: 10, hs: 30, bs: 20, p: 0, rc: 112, hy: 22, lim: 'rk', stance: 'crouch', kd: 1 }),
  'j+3':   M({ n: 'Jump Kick', h: 'm', s: 3, a: 12, r: 0, d: 10, hs: 18, bs: 12, p: 10, rc: 78, hy: 62, lim: 'lk', stance: 'air' }),
  'j+4':   M({ n: 'Flying Kick', h: 'm', s: 4, a: 12, r: 0, d: 12, hs: 20, bs: 14, p: 14, rc: 84, hy: 56, lim: 'rk', stance: 'air' }),
};
const THROWS = {
  T1: { n: 'Shoulder Throw', d: 17, br: 'lp', s: 10 },
  T2: { n: 'Suplex', d: 21, br: 'rp', s: 10 },
};
'use strict';
// Fighter state machine, hit resolution, throws, juggles. No DOM access here.
const FREE = ['idle', 'walk', 'crouch'];
const STUN = ['hit', 'bstun', 'stagger'];
const HOOK = { spark() {}, sfx() {}, text() {}, stop() {}, shake() {} };
const RULES = { noko: false };

class Fighter {
  constructor(id, name, pal) {
    this.id = id; this.name = name; this.pal = pal; this.wins = 0;
    this.prev = {}; this.inp = {};
    this.reset(id ? 660 : 300, id ? -1 : 1);
  }
  reset(x, dir) {
    Object.assign(this, {
      x, y: 0, vx: 0, vy: 0, dir, hp: MAXHP, lag: MAXHP, state: 'idle', t: 0, move: null, hit: false,
      stun: 0, chainReq: null, chainBtn: null, combo: 0, comboDmg: 0, comboT: 0, juggle: 0, tapF: 0, tapB: 0,
      buf: { lp: 0, rp: 0, lk: 0, rk: 0 }, rel: { back: false, fwd: false, up: false, down: false },
      tapEdge: {}, crh: false, rage: false, flash: 0, anim: 0, jm: null, jt: 0, tt: null, noHit: false,
      act: null, lastMove: '', dashDir: 1, ko: false,
    });
  }
}

function pre(f) {
  const i = f.inp, p = f.prev;
  for (const b of BTNS) {
    if (i[b] && !p[b]) f.buf[b] = 6; else if (f.buf[b] > 0) f.buf[b]--;
  }
  const back = f.dir > 0 ? i.l : i.r, fwd = f.dir > 0 ? i.r : i.l;
  const pb = f.dir > 0 ? p.l : p.r, pf = f.dir > 0 ? p.r : p.l;
  f.rel = { back: !!back, fwd: !!fwd, up: !!i.u, down: !!i.d };
  f.tapEdge = { f: !!fwd && !pf, b: !!back && !pb };
  if (f.tapF > 0) f.tapF--;
  if (f.tapB > 0) f.tapB--;
  f.prev = Object.assign({}, i);
}

const face = (f, o) => { f.dir = o.x >= f.x ? 1 : -1; };

function pickBtn(f) {
  let best = null, bv = 0;
  for (const b of BTNS) { const v = f.buf[b]; if (v > 0 && v <= 5 && v > bv) { bv = v; best = b; } }
  return best;
}
function pickMove(f, btn) {
  const n = { lp: '1', rp: '2', lk: '3', rk: '4' }[btn], r = f.rel, keys = [];
  if (r.down && r.fwd) keys.push('df+' + n);
  if (r.down) keys.push('d+' + n);
  if (r.fwd) keys.push('f+' + n);
  keys.push(n);
  return keys.find((k) => MOVES[k]);
}
function startMove(f, key, chained) {
  f.state = 'atk'; f.move = key; f.t = chained ? 4 : 0; f.hit = false; f.chainReq = null; f.vx = 0;
  f.lastMove = MOVES[key].n;
}
function startThrow(f, k) { f.state = 'throwing'; f.tt = k; f.t = 0; f.vx = 0; f.lastMove = THROWS[k].n; }

function free(f, o) {
  face(f, o);
  const r = f.rel;
  if (f.buf.lp > 0 && f.buf.lk > 0) { f.buf.lp = f.buf.lk = 0; return startThrow(f, 'T1'); }
  if (f.buf.rp > 0 && f.buf.rk > 0) { f.buf.rp = f.buf.rk = 0; return startThrow(f, 'T2'); }
  const b = pickBtn(f);
  if (b) { f.buf[b] = 0; return startMove(f, pickMove(f, b), false); }
  if (r.up) {
    f.state = 'jump'; f.t = 0; f.vy = 17; f.jm = null; f.hit = false;
    f.vx = r.fwd ? f.dir * 3.6 : r.back ? -f.dir * 3 : 0;
    return;
  }
  if (f.tapEdge.f) { if (f.tapF > 0) { f.tapF = 0; f.state = 'dash'; f.t = 0; f.dashDir = 1; return; } f.tapF = 14; }
  if (f.tapEdge.b) { if (f.tapB > 0) { f.tapB = 0; f.state = 'dash'; f.t = 0; f.dashDir = -1; return; } f.tapB = 14; }
  if (r.down) { f.state = 'crouch'; f.crh = true; f.vx = 0; }
  else if (r.fwd) { f.state = 'walk'; f.vx = f.dir * 2.5; }
  else if (r.back) { f.state = 'walk'; f.vx = -f.dir * 2.1; }
  else { f.state = 'idle'; f.vx = 0; }
}

function dash(f, o) {
  face(f, o);
  const t = f.t, n = f.dashDir > 0 ? 16 : 18;
  const sp = Math.max(0, (f.dashDir > 0 ? 9 : 7.5) - 0.5 * t);
  f.vx = f.dir * f.dashDir * sp;
  if (t >= 7 && f.dashDir > 0) { const b = pickBtn(f); if (b) { f.buf[b] = 0; return startMove(f, pickMove(f, b), false); } }
  if (t > n) { f.state = 'idle'; f.t = 0; f.vx = 0; }
}

function jump(f) {
  f.vy -= GRAV; f.y += f.vy;
  if (!f.jm) {
    const b = f.buf.lk > 0 ? 'lk' : f.buf.rk > 0 ? 'rk' : null;
    if (b) { f.buf[b] = 0; f.jm = b === 'lk' ? 'j+3' : 'j+4'; f.jt = 0; f.hit = false; f.lastMove = MOVES[f.jm].n; }
  } else {
    f.jt++;
    const m = MOVES[f.jm];
    if (!f.hit && f.jt >= m.s && f.jt < m.s + m.a) f.act = m;
  }
  if (f.y <= 0 && f.vy < 0) { f.y = 0; f.vy = 0; f.vx = 0; f.state = 'idle'; f.t = 0; f.jm = null; }
}

function atk(f) {
  const m = MOVES[f.move], t = f.t;
  f.crh = m.stance === 'crouch';
  if (m.c) for (const k in m.c) { const b = BTN[k]; if (f.buf[b] > 0 && t >= 2) { f.chainReq = m.c[k]; f.chainBtn = b; } }
  if (m.mv && t < m.s) f.vx = f.dir * m.mv; else f.vx *= 0.7;
  if (!f.hit && t >= m.s && t < m.s + m.a) f.act = m;
  if (f.chainReq && t >= m.cr) { f.buf[f.chainBtn] = 0; startMove(f, f.chainReq, true); return; }
  if (t >= m.s + m.a + m.r) { f.state = 'idle'; f.t = 0; }
}

function air(f) {
  f.vy -= GRAV; f.y += f.vy; f.vx *= 0.985;
  if (f.y <= 0 && f.vy < 0) {
    f.y = 0; f.vy = 0; f.vx *= 0.3; f.juggle = 0; f.noHit = false;
    f.state = f.ko ? 'ko' : 'down'; f.t = 0;
    HOOK.sfx('land'); HOOK.shake(6);
  }
}

function throwing(f, o) {
  const T = THROWS[f.tt];
  if (f.t === T.s) {
    const ok = Math.abs(o.x - f.x) < 86 && o.y < 8 &&
      ['idle', 'walk', 'crouch', 'bstun', 'atk', 'dash', 'stagger', 'getup'].includes(o.state);
    if (ok) {
      f.state = 'grab'; f.t = 0; o.state = 'thrown'; o.t = 0; o.vx = 0; o.act = null; o.dir = -f.dir;
      HOOK.sfx('grab'); return;
    }
  }
  if (f.t > T.s + 24) { f.state = 'idle'; f.t = 0; }
}

function grab(f, o) {
  const T = THROWS[f.tt];
  f.vx = 0; o.vx = 0; o.x = f.x + f.dir * 46; o.y = 0; o.dir = -f.dir;
  if (f.t <= 14 && o.buf[T.br] > 0) {
    f.state = o.state = 'stagger'; f.stun = o.stun = 22; f.vx = -f.dir * 4; o.vx = -o.dir * 4;
    HOOK.text((f.x + o.x) / 2, 150, 'THROW BREAK', '#7fe0ff'); HOOK.sfx('break'); return;
  }
  if (f.t === 16) {
    const dmg = Math.round(T.d * (f.rage ? 1.12 : 1));
    o.hp = Math.max(RULES.noko ? 1 : 0, o.hp - dmg);
    f.combo = 1; f.comboDmg = dmg; f.comboT = 80;
    o.state = 'air'; o.t = 0; o.vy = 9; o.vx = f.dir * 4.5; o.juggle = 4; o.ko = o.hp <= 0; o.flash = 4;
    if (o.ko) { o.vy = 12; o.vx = f.dir * 6; o.noHit = true; }
    f.state = 'stagger'; f.stun = 24;
    HOOK.spark(o.x, 90, 'hit'); HOOK.sfx('heavy'); HOOK.stop(9); HOOK.shake(9);
  }
}

function update(f, o) {
  f.anim++; f.t++; f.act = null; f.crh = false;
  if (f.flash > 0) f.flash--;
  if (f.comboT > 0 && --f.comboT === 0) { f.combo = 0; f.comboDmg = 0; }
  f.rage = f.hp > 0 && f.hp <= MAXHP * 0.25;
  switch (f.state) {
    case 'idle': case 'walk': case 'crouch': free(f, o); break;
    case 'dash': dash(f, o); break;
    case 'jump': jump(f); break;
    case 'atk': atk(f); break;
    case 'throwing': throwing(f, o); break;
    case 'grab': grab(f, o); break;
    case 'thrown': if (o.state !== 'grab') { f.state = 'idle'; f.t = 0; } break;
    case 'hit': case 'bstun': case 'stagger':
      if (f.state === 'bstun' && f.rel.down) f.crh = true;
      f.vx *= 0.86;
      if (--f.stun <= 0) { f.state = 'idle'; f.t = 0; }
      break;
    case 'air': air(f); break;
    case 'down': f.vx *= 0.85; if (f.t > 38) { f.state = 'getup'; f.t = 0; } break;
    case 'getup': if (f.t > 16) { f.state = 'idle'; f.t = 0; } break;
    case 'ko': f.vx *= 0.85; break;
  }
  if (f.state !== 'thrown' && f.state !== 'grab') f.x += f.vx;
}

function evalHit(a, d, m) {
  if (['down', 'thrown', 'ko', 'grab'].includes(d.state) || d.noHit) return null;
  const air = d.state === 'air' || d.y > 6;
  const x0 = a.x + a.dir * 6, x1 = a.x + a.dir * (m.rc + (air ? 16 : 0));
  if (Math.max(x0, x1) < d.x - 26 || Math.min(x0, x1) > d.x + 26) return null;
  if (!air) {
    const top = d.y + (d.crh ? 100 : 168), hy = a.y + m.hy;
    if (hy + m.hh < d.y || hy - m.hh > top) return null;
    if (m.h === 'h' && d.crh) return null; // ducked under
  }
  const canG = ['idle', 'walk', 'crouch', 'bstun'].includes(d.state) && d.rel.back && !air;
  let blocked = false;
  if (canG) blocked = m.h === 'h' ? true : m.h === 'm' ? !d.rel.down : d.rel.down;
  return { blocked, ctr: !blocked && d.state === 'atk', air, dstate: d.state };
}

function applyHit(a, d, m, res) {
  a.hit = true;
  const px = a.x + a.dir * Math.min(m.rc * 0.8, Math.abs(d.x - a.x)), py = a.y + m.hy;
  if (res.blocked) {
    d.state = 'bstun'; d.t = 0; d.stun = m.bs; d.vx = a.dir * m.pb * 0.35; a.vx = -a.dir * m.pb * 0.1;
    HOOK.spark(px, py, 'block'); HOOK.sfx('block'); HOOK.stop(3);
    return;
  }
  let dmg = m.d * (a.rage ? 1.12 : 1) * (res.ctr ? 1.25 : 1);
  if (res.air) dmg *= Math.max(0.35, Math.pow(0.8, d.juggle));
  dmg = Math.max(1, Math.round(dmg));
  d.hp = Math.max(RULES.noko ? 1 : 0, d.hp - dmg);
  if (res.dstate === 'hit' || res.dstate === 'air') a.combo++; else { a.combo = 1; a.comboDmg = 0; }
  a.comboDmg += dmg; a.comboT = 80;
  d.t = 0; d.flash = 4; d.jm = null;
  if (res.air) {
    d.state = 'air'; d.vy = Math.max(5, 8 - d.juggle * 1.5); d.vx = a.dir * 3.2; d.juggle++;
    if (d.juggle >= 5) d.noHit = true;
  } else if (m.la) { d.state = 'air'; d.vy = 19; d.vx = a.dir * 3; d.juggle = 1; }
  else if (m.kd) { d.state = 'air'; d.vy = 8; d.vx = a.dir * 4; d.juggle = 4; }
  else { d.state = 'hit'; d.stun = m.hs + (res.ctr ? 4 : 0); d.vx = a.dir * m.p * 0.35; }
  if (d.hp <= 0) { d.state = 'air'; d.vy = Math.max(d.vy, 12); d.vx = a.dir * 6; d.ko = true; d.noHit = true; d.juggle = 9; }
  HOOK.spark(px, py, res.ctr ? 'counter' : 'hit');
  if (res.ctr) HOOK.text(px, py + 40, 'COUNTER HIT', '#ffd23f');
  HOOK.sfx(res.ctr || m.la || m.kd ? 'heavy' : 'hit');
  HOOK.stop(4 + Math.min(6, (dmg / 3) | 0) + (res.ctr ? 2 : 0));
  HOOK.shake(3 + Math.min(8, dmg / 2));
}

function separate(a, b) {
  const bad = ['grab', 'thrown'];
  if (bad.includes(a.state) || bad.includes(b.state) || a.y > 60 || b.y > 60) return;
  const dx = b.x - a.x, d = Math.abs(dx), min = 44;
  if (d < min) { const s = dx >= 0 ? 1 : -1, ov = (min - d) / 2; a.x -= s * ov; b.x += s * ov; }
}
function wall(f, o) {
  const pushed = STUN.includes(f.state) || f.state === 'air';
  if (f.x < WALL_L) { const ov = WALL_L - f.x; f.x = WALL_L; if (pushed) o.x += ov * 0.7; }
  else if (f.x > WALL_R) { const ov = f.x - WALL_R; f.x = WALL_R; if (pushed) o.x -= ov * 0.7; }
}

function stepFighters(a, b) {
  update(a, b); update(b, a);
  const ra = a.act ? evalHit(a, b, a.act) : null, rb = b.act ? evalHit(b, a, b.act) : null;
  if (ra) applyHit(a, b, a.act, ra);
  if (rb) applyHit(b, a, b.act, rb);
  separate(a, b); wall(a, b); wall(b, a);
  for (const f of [a, b]) if (f.lag > f.hp) f.lag = Math.max(f.hp, f.lag - 0.6);
}
'use strict';
// CPU opponent. Produces the same input object a keyboard would.
const AIL = [
  { block: 0.3, aggr: 0.35, tech: 0.15, pun: 0.2, cd: [20, 55] },
  { block: 0.55, aggr: 0.6, tech: 0.45, pun: 0.5, cd: [12, 38] },
  { block: 0.82, aggr: 0.85, tech: 0.8, pun: 0.8, cd: [6, 24] },
];
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const newAI = () => ({ seq: [], cd: 30, blockDec: null, tech: null });
const tap = (btns, keys = []) => [{ k: keys, b: btns, n: 3 }, { k: [], b: [], n: 2 }];
const wait = (n) => [{ k: [], b: [], n }];

function aiInput(me, o, ai, L) {
  const inp = { l: 0, r: 0, u: 0, d: 0, lp: 0, rp: 0, lk: 0, rk: 0 };
  const set = (keys, btns) => {
    for (const k of keys) {
      if (k === 'f') inp[me.dir > 0 ? 'r' : 'l'] = 1;
      else if (k === 'b') inp[me.dir > 0 ? 'l' : 'r'] = 1;
      else if (k === 'd') inp.d = 1;
      else if (k === 'u') inp.u = 1;
    }
    for (const b of btns) inp[b] = 1;
  };
  const dist = Math.abs(o.x - me.x), st = me.state, om = MOVES[o.move];
  const loose = ['idle', 'walk', 'crouch'].includes(st);

  if (st === 'thrown') {
    if (ai.tech === null) { const T = THROWS[o.tt]; ai.tech = Math.random() < L.tech ? { at: rnd(2, 13), b: T ? T.br : 'lp' } : { at: -1 }; }
    if (ai.tech.at > 0 && me.t === ai.tech.at) set([], [ai.tech.b]);
    return inp;
  }
  ai.tech = null;
  if (st === 'bstun') { set(om && om.h === 'l' ? ['b', 'd'] : ['b'], []); return inp; }
  if (!['idle', 'walk', 'crouch', 'dash', 'atk', 'jump'].includes(st)) { ai.seq = []; return inp; }

  // defence
  if (o.state === 'atk' && om) {
    if (loose && o.t < om.s + om.a && dist < om.rc + 30) {
      if (ai.blockDec === null) ai.blockDec = Math.random() < L.block;
      if (ai.blockDec) { ai.seq = []; set(om.h === 'l' ? ['b', 'd'] : ['b'], []); return inp; }
    }
    // punish a whiffed / blocked move
    if (loose && !ai.seq.length && o.t > om.s + om.a + 3 && dist < 100 && Math.random() < L.pun * 0.06) {
      ai.seq = om.r >= 24 && Math.random() < 0.6 ? tap(['rp'], ['d', 'f']) : tap(['lp']);
    }
  } else ai.blockDec = null;

  // juggle follow-up
  if (o.state === 'air' && o.juggle < 4 && dist < 110 && ['idle', 'walk'].includes(st) && !ai.seq.length && Math.random() < L.pun * 0.5) {
    ai.seq = tap(['lp']);
    if (Math.random() < 0.5) ai.seq = ai.seq.concat(wait(5), tap(['rp']));
  }

  if (ai.seq.length) { const s = ai.seq[0]; set(s.k, s.b); if (--s.n <= 0) ai.seq.shift(); return inp; }
  if (!['idle', 'walk', 'crouch', 'dash'].includes(st)) return inp;
  if (ai.cd > 0) { ai.cd--; if (dist > 170) set(['f'], []); return inp; }

  const r = Math.random();
  const fwd = (n) => [{ k: ['f'], b: [], n }];
  if (dist > 240) {
    ai.seq = r < 0.25 ? [{ k: ['f'], b: [], n: 2 }, { k: [], b: [], n: 2 }, { k: ['f'], b: [], n: 16 }] : fwd(rnd(18, 36));
    ai.cd = 0; return inp;
  }
  if (dist > 135) {
    if (r < 0.5 * L.aggr + 0.2) { ai.seq = fwd(rnd(10, 20)); ai.cd = 0; return inp; }
    if (r < 0.65) ai.seq = [{ k: ['u', 'f'], b: [], n: 2 }, { k: ['f'], b: [], n: 9 }, { k: [], b: [Math.random() < 0.5 ? 'lk' : 'rk'], n: 3 }];
    else if (r < 0.8) ai.seq = [{ k: ['b'], b: [], n: 12 }];
    else ai.seq = [{ k: ['d'], b: ['rk'], n: 3 }];
  } else if (dist > 88) {
    if (r < 0.3) ai.seq = [{ k: ['f'], b: ['lk'], n: 3 }];
    else if (r < 0.5) ai.seq = tap(['lk']).concat(wait(8), tap(['rk']));
    else if (r < 0.65) ai.seq = tap(['rp'], ['d', 'f']);
    else if (r < 0.8) ai.seq = [{ k: ['d'], b: ['rk'], n: 3 }];
    else { ai.seq = fwd(rnd(5, 9)); ai.cd = 0; return inp; }
  } else {
    if (r < 0.22) ai.seq = tap(['lp']).concat(wait(7), tap(['rp']), wait(7), tap(['lk']));
    else if (r < 0.4) ai.seq = tap(['rp'], ['d', 'f']);
    else if (r < 0.52) ai.seq = [{ k: [], b: ['lp', 'lk'], n: 3 }];
    else if (r < 0.64) ai.seq = tap(['lk'], ['d']).concat(wait(6), tap(['rp']));
    else if (r < 0.74) ai.seq = [{ k: ['f'], b: ['rp'], n: 3 }];
    else if (r < 0.82) ai.seq = [{ k: ['d'], b: ['rk'], n: 3 }];
    else ai.seq = [{ k: ['b'], b: [], n: 14 }];
  }
  ai.cd = rnd(L.cd[0], L.cd[1]);
  return inp;
}
'use strict';
// Canvas drawing: stage, fighters, effects, HUD.
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const DPR = Math.min(2, window.devicePixelRatio || 1);
cv.width = W * DPR; cv.height = H * DPR;
const FXS = [], TXT = [];

function mkCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w * DPR; c.height = h * DPR;
  const x = c.getContext('2d'); x.scale(DPR, DPR); return [c, x];
}
const [stageC, sx] = mkCanvas(W, H);

(function drawStage() {
  const g = sx.createLinearGradient(0, 0, 0, FLOOR);
  g.addColorStop(0, '#150d2e'); g.addColorStop(0.55, '#4a2257'); g.addColorStop(0.85, '#b3505a'); g.addColorStop(1, '#f08a5d');
  sx.fillStyle = g; sx.fillRect(0, 0, W, H);
  let s = 7; const rn = () => (s = (s * 16807) % 2147483647) / 2147483647;
  sx.fillStyle = 'rgba(255,240,220,.7)';
  for (let i = 0; i < 70; i++) sx.fillRect(rn() * W, rn() * 220, 1.5, 1.5);
  const mg = sx.createRadialGradient(700, 125, 10, 700, 125, 160);
  mg.addColorStop(0, 'rgba(255,235,200,.45)'); mg.addColorStop(1, 'rgba(255,235,200,0)');
  sx.fillStyle = mg; sx.fillRect(480, 0, 440, 300);
  sx.fillStyle = '#fbe9c8'; sx.beginPath(); sx.arc(700, 125, 52, 0, 7); sx.fill();
  const ridge = (base, amp, col, seed) => {
    sx.fillStyle = col; sx.beginPath(); sx.moveTo(0, FLOOR);
    for (let x = 0; x <= W; x += 30) sx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.011 + seed) + 0.4 * Math.sin(x * 0.027 + seed * 2)));
    sx.lineTo(W, FLOOR); sx.closePath(); sx.fill();
  };
  ridge(FLOOR - 150, 90, '#3b1f4d', 1); ridge(FLOOR - 110, 70, '#2a1740', 4);
  const pag = (x, y, sc, col) => {
    sx.fillStyle = col;
    for (let i = 0; i < 4; i++) {
      const w = (120 - i * 22) * sc, h = 26 * sc, yy = y - i * h * 1.5;
      sx.beginPath(); sx.moveTo(x - w / 2 - 16 * sc, yy); sx.lineTo(x + w / 2 + 16 * sc, yy);
      sx.lineTo(x + w / 2 - 6 * sc, yy - h * 0.55); sx.lineTo(x - w / 2 + 6 * sc, yy - h * 0.55); sx.closePath(); sx.fill();
      sx.fillRect(x - w / 2 + 8 * sc, yy, w - 16 * sc, h * 0.7);
    }
    sx.fillRect(x - 2 * sc, y - 4 * 26 * sc * 1.5 - 30 * sc, 4 * sc, 30 * sc);
  };
  pag(170, FLOOR - 60, 1.05, '#1a0f2b');
  sx.fillStyle = '#1c1228'; sx.fillRect(0, FLOOR - 70, W, 58);
  sx.fillStyle = '#150d20';
  for (let x = 20; x < W; x += 180) sx.fillRect(x, FLOOR - 90, 14, 78);
  for (const lx of [110, 290, 470, 650, 830]) {
    const lg = sx.createRadialGradient(lx, FLOOR - 104, 2, lx, FLOOR - 104, 46);
    lg.addColorStop(0, 'rgba(255,170,80,.65)'); lg.addColorStop(1, 'rgba(255,170,80,0)');
    sx.fillStyle = lg; sx.fillRect(lx - 50, FLOOR - 154, 100, 100);
    sx.fillStyle = '#f2a04a'; sx.fillRect(lx - 7, FLOOR - 112, 14, 18);
    sx.fillStyle = '#150d20'; sx.fillRect(lx - 1, FLOOR - 124, 2, 12);
  }
  const fg = sx.createLinearGradient(0, FLOOR - 14, 0, H);
  fg.addColorStop(0, '#3a2630'); fg.addColorStop(1, '#130b14');
  sx.fillStyle = fg; sx.fillRect(0, FLOOR - 14, W, H - FLOOR + 14);
  sx.strokeStyle = 'rgba(0,0,0,.35)'; sx.lineWidth = 1.5;
  for (let i = -14; i <= 14; i++) { sx.beginPath(); sx.moveTo(W / 2 + i * 44, FLOOR - 14); sx.lineTo(W / 2 + i * 130, H); sx.stroke(); }
  for (let k = 1; k < 7; k++) { const y = FLOOR - 14 + Math.pow(k / 7, 1.6) * (H - FLOOR + 14); sx.beginPath(); sx.moveTo(0, y); sx.lineTo(W, y); sx.stroke(); }
  sx.strokeStyle = '#8a5d48'; sx.lineWidth = 2; sx.beginPath(); sx.moveTo(0, FLOOR - 14); sx.lineTo(W, FLOOR - 14); sx.stroke();
  const vg = sx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 620);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
  sx.fillStyle = vg; sx.fillRect(0, 0, W, H);
})();

// ---------- fighters ----------
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
function ik(o, tg, l1, l2, bend) {
  let dx = tg[0] - o[0], dy = tg[1] - o[1], d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.01;
  if (d > max) { const k = max / d; dx *= k; dy *= k; d = max; }
  if (d < 1) d = 1;
  const a = Math.atan2(dy, dx);
  const c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const ja = a + bend * Math.acos(c);
  return { j: [o[0] + Math.cos(ja) * l1, o[1] + Math.sin(ja) * l1], e: [o[0] + dx, o[1] + dy] };
}
function ext(f, m) {
  const t = f.t;
  if (t < m.s) { const u = t / m.s; return u * u; }
  if (t < m.s + m.a) return 1;
  return Math.max(0, 1 - (t - m.s - m.a) / Math.min(m.r || 8, 14));
}

function pose(f, win) {
  const st = f.state, b = Math.sin(f.anim * 0.12) * 2;
  let P = f.crh
    ? { hip: [-4, -48], sh: [6, -96], hd: [10, -114], fh: [34, -100], bh: [22, -92], ff: [30, 0], bf: [-24, 0] }
    : { hip: [0, -86 + b * 0.4], sh: [2, -134 + b], hd: [4, -152 + b], fh: [32, -138 + b], bh: [20, -130 + b], ff: [24, 0], bf: [-20, 0] };
  if (st === 'walk' && !f.crh) {
    const w = f.anim * 0.25 * (f.vx * f.dir >= 0 ? 1 : -1);
    P.ff = [24 + Math.sin(w) * 16, -Math.max(0, Math.cos(w)) * 10];
    P.bf = [-20 - Math.sin(w) * 16, -Math.max(0, -Math.cos(w)) * 10];
  } else if (st === 'dash') {
    const k = 8 * f.dashDir; P.sh[0] += k; P.hd[0] += k * 1.3; P.ff = [34, -6]; P.bf = [-30, -4];
  } else if (st === 'atk') {
    const m = MOVES[f.move], e = ext(f, m), tg = [m.rc * 0.85, -m.hy - (m.la ? 22 * e : 0)];
    if (m.lim === 'lp') P.fh = lerp2(P.fh, tg, e);
    else if (m.lim === 'rp') { P.bh = lerp2(P.bh, tg, e); P.sh[0] += 6 * e; }
    else {
      const ft = [m.rc * 0.92, -m.hy];
      if (m.lim === 'lk') P.ff = lerp2(P.ff, ft, e); else P.bf = lerp2(P.bf, ft, e);
      P.sh[0] -= (m.hy > 100 ? 10 : 4) * e; P.hd[0] -= 8 * e;
    }
  } else if (st === 'jump') {
    P = { hip: [0, -72], sh: [2, -120], hd: [4, -138], fh: [30, -128], bh: [18, -120], ff: [16, -38], bf: [-10, -26] };
    if (f.jm) { const m = MOVES[f.jm], e = Math.min(1, f.jt / 4); P[m.lim === 'lk' ? 'ff' : 'bf'] = lerp2(P[m.lim === 'lk' ? 'ff' : 'bf'], [m.rc * 0.9, -m.hy], e); }
  } else if (st === 'air' || st === 'thrown') {
    P = { hip: [0, -86], sh: [-4, -134], hd: [-8, -152], fh: [26, -150], bh: [-18, -144], ff: [26, -52], bf: [-14, -34] };
  } else if (st === 'hit' || st === 'stagger') {
    P.sh[0] = -10; P.hd[0] = -15; P.fh = [16, -104]; P.bh = [2, -98];
  } else if (st === 'bstun') {
    P.sh[0] -= 4; P.hd[0] -= 4; P.fh = [34, f.crh ? -112 : -148]; P.bh = [24, f.crh ? -106 : -142];
  } else if (st === 'grab' || st === 'throwing') {
    P.fh = [40, -118]; P.bh = [32, -108]; P.sh[0] += 4;
  } else if (st === 'getup') {
    P = { hip: [-4, -48], sh: [6, -96], hd: [10, -114], fh: [30, -90], bh: [18, -84], ff: [30, 0], bf: [-24, 0] };
  }
  if (win) { P.fh = [16, -180]; P.bh = [-8, -178]; }
  return P;
}

function drawFighter(f, win) {
  const pal = f.pal, hit = f.flash > 0;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath();
  ctx.ellipse(f.x, FLOOR + 4, Math.max(14, 34 - f.y * 0.1), 7, 0, 0, 7); ctx.fill();
  ctx.translate(f.x, FLOOR - f.y); ctx.scale(f.dir, 1);
  if (f.rage) { ctx.shadowColor = '#ff3a2a'; ctx.shadowBlur = 18 + 6 * Math.sin(f.anim * 0.3); }
  const ln = (pts, w, c) => {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  };
  const dot = (p, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill(); };
  const cGi = hit ? '#fff' : pal.gi, cDk = hit ? '#ddd' : pal.dk, cPt = hit ? '#eee' : pal.pants;
  if (f.state === 'down' || f.state === 'ko') {
    const y0 = -12;
    ln([[-6, y0], [26, y0 + 2], [60, y0]], 11, cPt); ln([[-6, y0], [28, y0 - 6], [56, y0 - 10]], 11, cPt);
    ln([[-44, y0], [-4, y0]], 20, cGi); ln([[-40, y0 - 4], [-22, y0 - 20], [-2, y0 - 16]], 9, cDk);
    dot([-58, y0 - 2], 13, pal.skin); ln([[-70, y0 - 8], [-48, y0 - 10]], 5, pal.acc);
    ctx.restore(); return;
  }
  const P = pose(f, win);
  if (f.state === 'air' || f.state === 'thrown') {
    const a = -Math.min(1.3, 0.5 + f.t * 0.035);
    ctx.translate(0, -80); ctx.rotate(a); ctx.translate(0, 80);
  }
  const bl = ik(P.hip, P.bf, 48, 48, -1), fl = ik(P.hip, P.ff, 48, 48, -1);
  const ba = ik(P.sh, P.bh, 40, 40, 1), fa = ik(P.sh, P.fh, 40, 40, 1);
  ln([P.hip, bl.j, bl.e], 12, cDk === pal.dk ? '#1c1624' : cDk); dot(bl.e, 7, '#15101c');
  ln([P.sh, ba.j, ba.e], 10, cDk); dot(ba.e, 6.5, hit ? '#fff' : pal.skin);
  ln([P.hip, P.sh], 23, cGi);
  ctx.fillStyle = pal.acc; ctx.fillRect(P.hip[0] - 12, P.hip[1] - 6, 24, 7);
  ln([P.hip, fl.j, fl.e], 12.5, cPt); dot(fl.e, 7.5, '#15101c');
  dot(P.hd, 13.5, hit ? '#fff' : pal.skin);
  ctx.fillStyle = pal.hair; ctx.beginPath(); ctx.arc(P.hd[0] - 1, P.hd[1] - 2, 14.5, Math.PI * 1.02, Math.PI * 2.08); ctx.closePath(); ctx.fill();
  ln([[P.hd[0] - 13, P.hd[1] - 4], [P.hd[0] + 13, P.hd[1] - 5]], 4, pal.acc);
  ctx.fillStyle = '#1b1320'; ctx.fillRect(P.hd[0] + 5, P.hd[1] - 1, 4, 3);
  ln([P.sh, fa.j, fa.e], 10.5, cGi); dot(fa.e, 7, hit ? '#fff' : pal.skin);
  ctx.restore();
}

// ---------- effects ----------
function drawFX() {
  for (const s of FXS) {
    const k = s.t / (s.kind === 'counter' ? 16 : 11), a = 1 - k;
    ctx.save(); ctx.translate(s.x, s.y); ctx.globalAlpha = Math.max(0, a);
    if (s.kind === 'block') {
      ctx.strokeStyle = '#8fd8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 8 + k * 22, 0, 7); ctx.stroke();
    } else {
      const big = s.kind === 'counter' ? 1.5 : 1, col = s.kind === 'counter' ? '#ffd23f' : '#ffb347';
      ctx.strokeStyle = col; ctx.lineWidth = 3.5;
      for (let i = 0; i < 9; i++) {
        const an = i * 0.698 + (s.seed || 0), r0 = (8 + k * 14) * big, r1 = (20 + k * 34) * big;
        ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); ctx.stroke();
      }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, (10 - k * 8) * big, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  ctx.textAlign = 'center';
  for (const t of TXT) {
    ctx.globalAlpha = Math.min(1, (60 - t.t) / 20); ctx.fillStyle = t.col;
    ctx.font = '700 26px "Rajdhani", sans-serif'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4;
    ctx.strokeText(t.txt, t.x, t.y - t.t * 0.4); ctx.fillText(t.txt, t.x, t.y - t.t * 0.4);
  }
  ctx.globalAlpha = 1;
}

// ---------- HUD ----------
function bar(f, x, y, w, h, anchorRight) {
  ctx.fillStyle = 'rgba(10,8,16,.8)'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  const lw = w * f.lag / MAXHP, hw = w * f.hp / MAXHP;
  ctx.fillStyle = '#c4413a'; ctx.fillRect(anchorRight ? x + w - lw : x, y, lw, h);
  const low = f.hp <= MAXHP * 0.25, flash = low && (Math.floor(Date.now() / 120) % 2);
  ctx.fillStyle = flash ? '#ff7a45' : '#f2c230'; ctx.fillRect(anchorRight ? x + w - hw : x, y, hw, h);
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(anchorRight ? x + w - hw : x, y, hw, h * 0.35);
  ctx.strokeStyle = '#e8e2d4'; ctx.lineWidth = 2; ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
}
function banner(txt, sub, sc) {
  ctx.save(); ctx.textAlign = 'center'; ctx.translate(W / 2, H / 2 - 40); ctx.scale(sc, sc);
  ctx.font = '88px "Bebas Neue", Impact, sans-serif'; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(10,6,16,.85)';
  ctx.strokeText(txt, 0, 0); ctx.fillStyle = '#f2c230'; ctx.fillText(txt, 0, 0);
  if (sub) { ctx.font = '700 24px "Rajdhani", sans-serif'; ctx.fillStyle = '#e8e2d4'; ctx.fillText(sub, 0, 34); }
  ctx.restore();
}
function hud(a, b) {
  bar(a, 36, 28, 390, 24, true); bar(b, 534, 28, 390, 24, false);
  ctx.font = '700 22px "Rajdhani", sans-serif'; ctx.fillStyle = '#e8e2d4';
  ctx.textAlign = 'left'; ctx.fillText(a.name, 36, 76); ctx.textAlign = 'right'; ctx.fillText(b.name, 924, 76);
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = a.wins > i ? '#f2c230' : 'rgba(232,226,212,.25)'; ctx.fillRect(36 + i * 18, 84, 11, 11);
    ctx.fillStyle = b.wins > i ? '#f2c230' : 'rgba(232,226,212,.25)'; ctx.fillRect(913 - i * 18, 84, 11, 11);
  }
  ctx.textAlign = 'center'; ctx.font = '56px "Bebas Neue", Impact, sans-serif'; ctx.lineWidth = 5;
  const tm = G.mode === 'train' ? '∞' : String(Math.max(0, G.timer));
  ctx.strokeStyle = 'rgba(10,6,16,.85)'; ctx.strokeText(tm, W / 2, 68); ctx.fillStyle = G.timer <= 10 && G.mode !== 'train' ? '#ff7a45' : '#e8e2d4'; ctx.fillText(tm, W / 2, 68);
  for (const [f, x, al] of [[a, 40, 'left'], [b, 920, 'right']]) {
    if (f.combo >= 2 && f.comboT > 0) {
      ctx.textAlign = al; ctx.font = '64px "Bebas Neue", Impact, sans-serif'; ctx.strokeStyle = 'rgba(10,6,16,.85)'; ctx.lineWidth = 6;
      ctx.strokeText(f.combo + ' HITS', x, 170); ctx.fillStyle = '#f2c230'; ctx.fillText(f.combo + ' HITS', x, 170);
      ctx.font = '700 22px "Rajdhani", sans-serif'; ctx.fillStyle = '#e8e2d4'; ctx.fillText(f.comboDmg + ' damage', x, 196);
    }
    if (f.rage) { ctx.textAlign = al; ctx.font = '700 18px "Rajdhani", sans-serif'; ctx.fillStyle = '#ff5a4a'; ctx.fillText('RAGE', al === 'left' ? 36 : 924, 112); }
  }
  if (G.training) {
    ctx.textAlign = 'left'; ctx.font = '600 16px "Rajdhani", sans-serif';
    ctx.fillStyle = 'rgba(10,8,16,.7)'; ctx.fillRect(36, H - 62, 330, 46);
    ctx.fillStyle = '#e8e2d4';
    const m = MOVES[a.move], tag = m ? ({ h: 'HIGH', m: 'MID', l: 'LOW' })[m.h] + ' · ' + m.s + 'f startup · ' + m.d + ' dmg' : '';
    ctx.fillText('P1 move: ' + (a.lastMove || '-'), 46, H - 42); ctx.fillText(tag, 46, H - 24);
  }
}
function boxes(f) {
  const top = f.y + (f.crh ? 100 : 168);
  ctx.strokeStyle = '#4cf2a0'; ctx.lineWidth = 1.5; ctx.strokeRect(f.x - 26, FLOOR - top, 52, top - f.y);
  const m = f.act || (f.state === 'atk' && MOVES[f.move]);
  if (m && f.state === 'atk' && f.t >= m.s && f.t < m.s + m.a) {
    ctx.strokeStyle = '#ff4d4d'; const x1 = f.x + f.dir * m.rc;
    ctx.strokeRect(Math.min(f.x, x1), FLOOR - (f.y + m.hy + m.hh), Math.abs(x1 - f.x), m.hh * 2);
  }
}

function render(a, b) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  ctx.drawImage(stageC, 0, 0, W, H);
  const order = a.state === 'down' || a.state === 'ko' || a.state === 'air' ? [a, b] : [b, a];
  const winner = (G.phase === 'ko' && G.pt > 40) || G.phase === 'match' ? G.winner : -1;
  for (const f of order) drawFighter(f, winner === f.id);
  if (G.training) { boxes(a); boxes(b); }
  drawFX();
  ctx.restore();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  hud(a, b);
  if (G.phase === 'intro') { if (G.pt < 62) banner('ROUND ' + G.round, '', 1 + (G.pt < 8 ? (8 - G.pt) * 0.05 : 0)); else banner('FIGHT!', '', 1 + Math.max(0, (70 - G.pt)) * 0.012); }
  else if (G.phase === 'ko') banner(G.msg, G.winner >= 0 ? (G.winner ? b : a).name + ' takes the round' : 'Draw', 1);
  else if (G.phase === 'match') banner(G.winner >= 0 ? (G.winner ? b : a).name + ' WINS' : 'DRAW', '', 1);
}
'use strict';
// Input, match flow, audio, main loop.
const PAL1 = { gi: '#d6403a', dk: '#8f2723', pants: '#2b2433', skin: '#e0b08c', acc: '#f2c230', hair: '#1b1320' };
const PAL2 = { gi: '#3a8fd0', dk: '#24608f', pants: '#26303a', skin: '#c99772', acc: '#e8e2d4', hair: '#d9d4c8' };
const p1 = new Fighter(0, 'RIKU', PAL1), p2 = new Fighter(1, 'VOLK', PAL2);
const G = { mode: 'menu', lvl: 1, round: 1, timer: 60, tm: 0, tickN: 0, hitstop: 0, shake: 0, phase: 'intro', pt: 0,
  paused: false, training: false, msg: '', winner: -1, ai: newAI(), idleT: 0 };

// ---------- audio ----------
let AC = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f0, f1, dur, type, vol) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
}
function noise(dur, vol, cutoff) {
  const a = audio(); if (!a) return;
  const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  f.type = 'lowpass'; f.frequency.value = cutoff; g.gain.value = vol;
  s.buffer = buf; s.connect(f).connect(g).connect(a.destination); s.start();
}
HOOK.sfx = (k) => {
  if (k === 'hit') { noise(0.09, 0.5, 2400); tone(160, 60, 0.09, 'triangle', 0.3); }
  else if (k === 'heavy') { noise(0.18, 0.7, 1800); tone(120, 40, 0.2, 'triangle', 0.5); }
  else if (k === 'block') { tone(300, 180, 0.07, 'square', 0.12); noise(0.05, 0.2, 5000); }
  else if (k === 'land') { tone(70, 30, 0.18, 'sine', 0.5); }
  else if (k === 'grab') { tone(220, 330, 0.08, 'square', 0.12); }
  else if (k === 'break') { tone(880, 1320, 0.14, 'sine', 0.25); }
};
HOOK.spark = (x, y, kind) => FXS.push({ x, y: FLOOR - y, kind, t: 0, seed: Math.random() * 6 });
HOOK.text = (x, y, txt, col) => TXT.push({ x, y: FLOOR - y - 60, txt, col, t: 0 });
HOOK.stop = (n) => { G.hitstop = Math.max(G.hitstop, n); };
HOOK.shake = (n) => { G.shake = Math.max(G.shake, n); };

// ---------- input ----------
const KEYS = {};
const LISTENERS = [];
function listen(t, f) { window.addEventListener(t, f); LISTENERS.push([t, f]); }
const MAP1 = { KeyA: 'l', KeyD: 'r', KeyW: 'u', KeyS: 'd', KeyU: 'lp', KeyI: 'rp', KeyJ: 'lk', KeyK: 'rk' };
const MAP2 = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', KeyO: 'lp', KeyP: 'rp', KeyL: 'lk', Semicolon: 'rk' };
const blank = () => ({ l: 0, r: 0, u: 0, d: 0, lp: 0, rp: 0, lk: 0, rk: 0 });
const gather = (map, out) => { for (const c in map) if (KEYS[c]) out[map[c]] = 1; };
listen('keydown', (e) => {
  if (e.code in MAP1 || e.code in MAP2 || e.code === 'Space') { if (G.mode !== 'menu') e.preventDefault(); }
  KEYS[e.code] = true; audio();
  if (e.repeat) return;
  if (e.code === 'Escape' && G.mode !== 'menu') togglePause();
  if (e.code === 'KeyT' && G.mode !== 'menu') G.training = !G.training;
});
listen('keyup', (e) => { KEYS[e.code] = false; });
listen('blur', () => { for (const k in KEYS) KEYS[k] = false; });

const TOUCH = {};
document.querySelectorAll('[data-k]').forEach((el) => {
  const ks = el.dataset.k.split('+').filter(Boolean);
  el.onpointerdown = (e) => {
    e.preventDefault(); audio();
    ks.forEach((k) => { TOUCH[k] = (TOUCH[k] || 0) + 1; }); el.classList.add('on');
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  };
  const off = () => { if (!el.classList.contains('on')) return; ks.forEach((k) => { TOUCH[k] = Math.max(0, (TOUCH[k] || 0) - 1); }); el.classList.remove('on'); };
  el.onpointerup = off; el.onpointercancel = off;
});

// ---------- match flow ----------
function newRound() {
  p1.reset(300, 1); p2.reset(660, -1);
  G.timer = 60; G.tm = 0; G.phase = 'intro'; G.pt = 0; G.hitstop = 0; G.winner = -1; G.idleT = 0;
  G.ai = newAI(); FXS.length = 0; TXT.length = 0;
}
function startMatch(mode, lvl) {
  G.mode = mode; G.lvl = lvl; G.round = 1; G.training = mode === 'train'; G.paused = false;
  RULES.noko = mode === 'train'; p1.wins = p2.wins = 0;
  newRound();
  show('menu', false); show('end', false); show('pause', false);
}
function endRound() {
  if (G.winner === 0) p1.wins++; else if (G.winner === 1) p2.wins++; else if (G.winner === -2) { p1.wins++; p2.wins++; }
  if (G.winner === -2) G.winner = -1;
  if (p1.wins >= 2 || p2.wins >= 2) {
    G.phase = 'match';
    if (p1.wins >= 2 && p2.wins >= 2) G.winner = -1; else G.winner = p1.wins >= 2 ? 0 : 1;
    document.getElementById('endtxt').textContent = G.winner < 0 ? 'Draw' : (G.winner ? p2 : p1).name + ' wins the match';
    show('end', true);
  } else { G.round++; newRound(); }
}
function judge(msg) {
  G.phase = 'ko'; G.pt = 0; G.msg = msg;
  if (p1.hp <= 0 && p2.hp <= 0) G.winner = -2;
  else if (p1.hp <= 0) G.winner = 1; else if (p2.hp <= 0) G.winner = 0;
  else G.winner = p1.hp === p2.hp ? -2 : p1.hp > p2.hp ? 0 : 1;
}

function tick() {
  if (G.mode === 'menu' || G.paused) return;
  G.tickN++;
  const i1 = blank(), i2 = blank();
  gather(MAP1, i1); if (G.mode !== '2p') gather(MAP2, i1);
  for (const k in TOUCH) if (TOUCH[k] > 0) i1[k] = 1;
  if (G.mode === '2p') gather(MAP2, i2);
  if (G.phase === 'intro') { G.pt++; if (G.pt > 115) { G.phase = 'fight'; G.pt = 0; } }
  else if (G.phase === 'fight' || G.phase === 'ko') {
    p1.inp = i1;
    p2.inp = G.mode === 'cpu' && G.phase === 'fight' ? aiInput(p2, p1, G.ai, AIL[G.lvl]) : i2;
    pre(p1); pre(p2);
    if (G.hitstop > 0) G.hitstop--;
    else if (G.phase === 'fight' || G.tickN % 2 === 0) stepFighters(p1, p2);
    if (G.phase === 'fight') {
      if (G.mode === 'train') {
        const calm = (f) => FREE.includes(f.state);
        G.idleT = calm(p1) && calm(p2) ? G.idleT + 1 : 0;
        if (G.idleT > 90) { p1.hp = p1.lag = p2.hp = p2.lag = MAXHP; }
      } else {
        if (++G.tm >= 60) { G.tm = 0; G.timer--; }
        if (p1.hp <= 0 || p2.hp <= 0) judge('K.O.');
        else if (G.timer <= 0) judge('TIME UP');
      }
    } else if (++G.pt > 160) endRound();
  }
  for (const s of FXS) s.t++;
  for (let i = FXS.length - 1; i >= 0; i--) if (FXS[i].t > 16) FXS.splice(i, 1);
  for (const t of TXT) t.t++;
  for (let i = TXT.length - 1; i >= 0; i--) if (TXT[i].t > 60) TXT.splice(i, 1);
  G.shake = G.shake > 0.4 ? G.shake * 0.85 : 0;
}

// ---------- UI wiring ----------
function show(id, on) { const el = document.getElementById(id); if (el) el.hidden = !on; }
function togglePause() {
  if (G.mode === 'menu' || G.phase === 'match') return;
  G.paused = !G.paused; show('pause', G.paused);
}
function toMenu() { G.mode = 'menu'; G.paused = false; show('pause', false); show('end', false); show('menu', true); }
let lvl = 1;
document.querySelectorAll('[data-lvl]').forEach((b) => { b.onclick = () => {
  lvl = +b.dataset.lvl; document.querySelectorAll('[data-lvl]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
}; });
const on = (id, fn) => { document.getElementById(id).onclick = () => { audio(); fn(); }; };
on('b-cpu', () => startMatch('cpu', lvl));
on('b-2p', () => startMatch('2p', lvl));
on('b-train', () => startMatch('train', lvl));
on('b-rematch', () => startMatch(G.mode, G.lvl));
on('b-menu', toMenu); on('b-menu2', toMenu);
on('b-resume', togglePause); on('b-pause', togglePause);

// touch controls toggle (defaults to automatic on touch screens and narrow windows)
const touchBar = document.querySelector('.touch'), touchBtn = document.getElementById('b-touch');
function syncTouchBtn() {
  const shown = !!touchBar && getComputedStyle(touchBar).display !== 'none';
  touchBtn.setAttribute('aria-pressed', String(shown));
}
touchBtn.onclick = () => {
  const shown = getComputedStyle(touchBar).display !== 'none';
  document.body.dataset.touch = shown ? 'off' : 'on';
  for (const k in TOUCH) TOUCH[k] = 0;
  syncTouchBtn();
};
listen('resize', syncTouchBtn);
syncTouchBtn();

// ---------- loop ----------
let last = performance.now(), acc = 0, RAF = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  const dt = 1000 / 60;
  while (acc >= dt) { tick(); acc -= dt; }
  render(p1, p2);
  RAF = requestAnimationFrame(frame);
}
RAF = requestAnimationFrame(frame);
// a republish re-runs this script: stop the old loop and listeners first
window.__ashenStop = () => { cancelAnimationFrame(RAF); LISTENERS.forEach(([t, f]) => window.removeEventListener(t, f)); };
})();
