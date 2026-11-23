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
    lg.addColorStop