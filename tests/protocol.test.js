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
