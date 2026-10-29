// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../web/razer-protocol.js');

test('v2 depth report: byte pairs until fwID 0', () => {
  // A at 0x40, S at 0x02, then padding.
  const data = [31, 0x40, 32, 0x02, 0, 0, 0, 0];
  assert.deepEqual(P.parseDepthReport('v2', data), [{ id: 31, raw: 0x40 }, { id: 32, raw: 2 }]);
  assert.deepEqual(P.parseDepthReport('v2', new Uint8Array(23)), []);
});

test('v3 depth report: fwID + u16 big-endian', () => {
  const data = new Uint8Array(46);
  data.set([127, 0x06, 0x66, 61, 0xff, 0xf0]);
  const keys = P.parseDepthReport('v3', data);
  assert.deepEqual(keys, [{ id: 127, raw: 0x0666 }, { id: 61, raw: 0xfff0 }]);
  assert.ok(Math.abs(P.FAMILIES.v3.rawToMm(0x0666) - 0.1) < 0.001);
  assert.ok(Math.abs(P.FAMILIES.v3.rawToMm(0xfff0) - 4.0) < 0.001);
});

test('parser accepts a DataView like WebHID delivers', () => {
  const buf = new Uint8Array([0xaa, 18, 9, 0, 0]).buffer;
  assert.deepEqual(P.parseDepthReport('v2', new DataView(buf, 1)), [{ id: 18, raw: 9 }]);
});

test('family is guessed from the report ID for unknown PIDs', () => {
  assert.equal(P.familyOf(0x02cf, 0x0b), 'v3');
  assert.equal(P.familyOf(0x0266, 0x07), 'v2');
  assert.equal(P.familyOf(0x9999, 0x0b), 'v3');
  assert.equal(P.familyOf(0x9999, 0x01), null);
});

test('tracker counts touches, peaks and implicit releases', () => {
  const t = new P.DepthTracker();
  t.update([{ id: 127, raw: 3 }], 0);
  t.update([{ id: 127, raw: 9 }, { id: 31, raw: 1 }], 10);
  let ended = t.update([{ id: 31, raw: 2 }], 25); // Win dropped out of the report
  assert.deepEqual(ended, [127]);
  ended = t.update([], 40);
  assert.deepEqual(ended, [31]);
  t.update([{ id: 127, raw: 4 }], 50);

  const win = t.stats.get(127);
  assert.equal(win.touches, 2);
  assert.equal(win.peak, 9);
  assert.equal(t.events[0].durationMs, 25);
  assert.equal(t.events[0].peak, 9);
  assert.equal(t.ranking()[0].id, 127);
  assert.equal(t.live.get(127), 4);
});

test('tracker noise floor hides jitter', () => {
  const t = new P.DepthTracker({ noiseFloor: 2 });
  t.update([{ id: 31, raw: 2 }], 0);
  assert.equal(t.stats.size, 0);
  t.update([{ id: 31, raw: 3 }], 1);
  assert.equal(t.stats.get(31).touches, 1);
});

test('control packet layout and CRC', () => {
  const p = P.getKeyAssignmentPacket(0, P.WIN_KEY);
  assert.equal(p.length, 90);
  assert.deepEqual([...p.slice(0, 11)], [0, 0x1f, 0, 0, 0, 80, 0x02, 0x92, 0, 127, 0]);
  assert.equal(p[88], 80 ^ 0x02 ^ 0x92 ^ 127);
  // Matches easyrazer's packet test vector.
  assert.equal(P.buildPacket(0x00, 0x82, 0x16)[88], 0x16 ^ 0x82);
});

test('reply parsing with and without a leading report ID', () => {
  const reply = P.buildPacket(0x02, 0x92, 80, [1, 0x1f, 0, 0x8f, 0x6f, 0x02, 0x02, 0x00, 0x04]);
  reply[0] = 0x02;
  for (const data of [reply, Uint8Array.from([0, ...reply])]) {
    const r = P.parseReply(data, 0x02, 0x92);
    assert.equal(r.statusText, 'ok');
    assert.ok(r.crcOk);
    // easyrazer's captured reply for key A, profile 3 (profile byte changed to 1).
    assert.deepEqual(P.parseKeyAssignment(r.args), {
      profile: 1, key: 31, layer: 0, thrL: 0x8f, thrH: 0x6f, fnId: 2, fnData: [0, 4],
    });
  }
  assert.equal(P.parseReply(reply, 0x02, 0x12), null);
});

test('set packet keeps the key function and moves only the thresholds', () => {
  const a = { profile: 0, key: 127, layer: 0, thrL: 77, thrH: 0, fnId: 2, fnData: [0x08, 0x00] };
  const b = P.withActuation(a, P.FAMILIES.v3.mmToThreshold(3.0));
  assert.equal(b.thrL, 192);
  assert.equal(b.thrH, 0);
  assert.deepEqual(b.fnData, a.fnData);
  const p = P.setKeyAssignmentPacket(b);
  assert.deepEqual([...p.slice(6, 17)], [0x02, 0x12, 0, 127, 0, 192, 0, 2, 2, 0x08, 0x00]);
  // A release point above the new actuation point is pulled below it.
  assert.equal(P.withActuation({ ...a, thrH: 150 }, 100).thrH, 90);
  // An explicit release point is kept as given, or rejected when too close.
  const v3 = P.FAMILIES.v3;
  const c = P.withActuation(a, v3.mmToThreshold(2.7), v3.mmToThreshold(2.5), v3.minReleaseGap);
  assert.deepEqual([c.thrL, c.thrH], [173, 160]);
  assert.throws(() => P.withActuation(a, 173, 170, v3.minReleaseGap), RangeError);
});

test('v3 thresholds are the high byte of the u16 scale', () => {
  const f = P.FAMILIES.v3;
  assert.equal(f.mmToThreshold(1.2), 77); // Synapse default 19656 >> 8
  assert.equal(f.mmToThreshold(4.0), 255);
  assert.equal(f.mmToThreshold(0), 1);
  for (let tenth = 1; tenth <= 40; tenth++) {
    const mm = tenth / 10;
    assert.equal(Math.round(f.thresholdToMm(f.mmToThreshold(mm)) * 10) / 10, mm);
  }
  assert.equal(P.FAMILIES.v2.mmToThreshold(2.4), 109);
});

test('layout covers the Win key and has no duplicate IDs', () => {
  const keys = P.layoutKeys();
  const ids = keys.map((k) => k.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes(P.WIN_KEY));
  for (const k of keys) assert.ok(P.KEY_NAMES[k.id], `name for ${k.id}`);
  const right = Math.max(...keys.map((k) => k.x + k.w));
  assert.equal(right, 22.5);
});

test('tracker estimates input on/off from actuation and release points', () => {
  const v3 = P.FAMILIES.v3;
  const t = new P.DepthTracker();
  // Win: actuation 2.7 mm, release 2.5 mm (as written by the actuation tab).
  const press = v3.thresholdToRaw(173), release = v3.thresholdToRaw(160);
  t.setThresholds([[127, { press, release }]]);

  // A light brush that never reaches 2.7 mm: sensed, not an input.
  t.update([{ id: 127, raw: v3.thresholdToRaw(100) }], 0);
  t.update([], 20);
  // A real press: crosses 2.7 mm at t=130, comes back above 2.5 mm at t=200, released at t=220.
  t.update([{ id: 127, raw: v3.thresholdToRaw(120) }], 100);
  t.update([{ id: 127, raw: press }], 130);
  assert.equal(t.active.has(127), true);
  t.update([{ id: 127, raw: v3.thresholdToRaw(165) }], 160); // between the points: still on
  assert.equal(t.active.has(127), true);
  t.update([{ id: 127, raw: release }], 200);
  assert.equal(t.active.has(127), false);
  t.update([], 220);

  const [brush, real] = t.events;
  assert.equal(brush.fired, false);
  assert.equal(brush.marginRaw, press - v3.thresholdToRaw(100));
  assert.equal(real.fired, true);
  assert.equal(real.activations, 1);
  assert.equal(real.firstOnMs, 30);
  assert.equal(real.heldMs, 70);
  assert.equal(t.stats.get(127).activations, 1);
  assert.deepEqual(t.onSpans.get(127), [[130, 200]]);
});

test('input that is still on when the key drops out of the stream is closed', () => {
  const t = new P.DepthTracker();
  t.setThresholds(new Map([[31, { press: 100, release: 90 }]]));
  t.update([{ id: 31, raw: 150 }], 0);
  t.update([], 50);
  assert.equal(t.active.size, 0);
  assert.equal(t.events[0].heldMs, 50);
  assert.deepEqual(t.onSpans.get(31), [[0, 50]]);
});

test('keys without a known actuation point report fired = null', () => {
  const t = new P.DepthTracker();
  t.update([{ id: 18, raw: 40 }], 0);
  t.update([], 10);
  assert.equal(t.events[0].fired, null);
  assert.equal(t.events[0].marginRaw, null);
});

test('history keeps the recent window plus one earlier sample', () => {
  const t = new P.DepthTracker({ historyMs: 100 });
  t.update([{ id: 31, raw: 5 }], 0);
  t.update([{ id: 31, raw: 6 }], 50);
  t.update([{ id: 31, raw: 6 }], 60); // unchanged value is not stored twice
  t.update([{ id: 31, raw: 7 }], 200);
  assert.deepEqual(t.history.get(31), [[50, 6], [200, 7]]);
  assert.equal(t.lastId, 31);
});

test('Korean and English UI strings define the same keys and placeholders', () => {
  const { STRINGS } = require('../web/i18n.js');
  const placeholders = (v) => (typeof v === 'string' ? [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort() : []);
  assert.deepEqual(Object.keys(STRINGS.ko).sort(), Object.keys(STRINGS.en).sort());
  for (const key of Object.keys(STRINGS.ko)) {
    assert.deepEqual(placeholders(STRINGS.ko[key]), placeholders(STRINGS.en[key]), key);
  }
  // Every string the page references exists.
  const html = require('fs').readFileSync(require('path').join(__dirname, '../web/index.html'), 'utf8');
  const used = [...html.matchAll(/data-i18n(?:-html|-title)?="(\w+)"/g), ...html.matchAll(/tr\('(\w+)'/g)].map((m) => m[1]);
  for (const key of used) assert.ok(key in STRINGS.en, key);
});

test('safety allowlist refuses everything but the four known commands', () => {
  // Allowed reads and a sane write.
  P.checkPacket(P.getKeyAssignmentPacket(0, 127), 'v3');
  P.checkPacket(P.buildPacket(0x05, 0x84, 1), 'v3');
  P.checkPacket(P.getDeviceModePacket(), 'v3');
  const ok = { profile: 1, key: 127, layer: 0, thrL: 173, thrH: 160, fnId: 2, fnData: [8, 0] };
  P.checkPacket(P.setKeyAssignmentPacket(ok), 'v3');
  P.checkPacket(P.setKeyAssignmentPacket({ ...ok, thrL: 0, thrH: 0 }), 'v3'); // undo to "host decides"

  // Mode switch (01 = bootloader), factory calibration write, flash, lighting: refused.
  for (const [cls, cmd, args] of [[0x00, 0x04, [0x01, 0]], [0xfe, 0x28, []], [0x06, 0x09, []], [0x0f, 0x02, []], [0x05, 0x04, [1]]]) {
    assert.throws(() => P.checkPacket(P.buildPacket(cls, cmd, args.length, args), 'v3'), P.SafetyError);
  }
  // Writes outside what the UI produces: refused.
  assert.throws(() => P.checkPacket(P.setKeyAssignmentPacket({ ...ok, layer: 1 }), 'v3'), P.SafetyError);
  assert.throws(() => P.checkPacket(P.setKeyAssignmentPacket({ ...ok, profile: 7 }), 'v3'), P.SafetyError);
  assert.throws(() => P.checkPacket(P.setKeyAssignmentPacket({ ...ok, key: 200 }), 'v3'), P.SafetyError);
  assert.throws(() => P.checkPacket(P.setKeyAssignmentPacket({ ...ok, thrH: 170 }), 'v3'), P.SafetyError);
  // Wrong length.
  assert.throws(() => P.checkPacket(new Uint8Array(10), 'v3'), P.SafetyError);
});
