// Achievements and daily login: run with `node test/game/progress.test.mjs` from the project root.
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, newAchievements, claimDaily, dailyReward, myDay } from '../../js/progress.js';

const H = 3600e3, D = 24 * H, T0 = Date.parse('2026-11-21T02:00:00Z'); // 10:00 in Malaysia
const tests = []; const test = (n, fn) => tests.push([n, fn]);

test('first claim of the day pays RM20 and starts a streak', () => { const S = {}; const r = claimDaily(S, T0); assert.deepEqual([r.ok, r.reward, r.streak], [true, 20, 1]); assert.equal(S.login.day, '2026-11-21'); });
test('a second claim the same Malaysian day is refused', () => { const S = {}; claimDaily(S, T0); assert.equal(claimDaily(S, T0 + 5 * H).reason, 'claimed'); });
test('the day rolls over at Malaysian midnight (16:00 UTC)', () => {
  const S = {}; claimDaily(S, Date.parse('2026-11-21T15:30:00Z'));
  assert.equal(claimDaily(S, Date.parse('2026-11-21T15:59:00Z')).ok, false);
  assert.equal(claimDaily(S, Date.parse('2026-11-21T16:01:00Z')).ok, true);
  assert.equal(myDay(Date.parse('2026-11-21T16:01:00Z')), '2026-11-22');
});
test('consecutive days grow the streak and reward, capped at day 7 (RM50)', () => {
  const S = {}; const got = []; for (let d = 0; d < 9; d++) got.push(claimDaily(S, T0 + d * D).reward);
  assert.deepEqual(got, [20, 25, 30, 35, 40, 45, 50, 50, 50]); assert.equal(S.login.streak, 9);
});
test('missing a day resets the streak', () => { const S = {}; claimDaily(S, T0); claimDaily(S, T0 + D); const r = claimDaily(S, T0 + 3 * D); assert.equal(r.streak, 1); assert.equal(r.reward, 20); });
test('turning the device clock back is refused (anti-abuse)', () => { const S = {}; claimDaily(S, T0 + 2 * D); assert.equal(claimDaily(S, T0 + D).reason, 'clock'); assert.equal(S.login.streak, 1); });
test('dailyReward table', () => { assert.equal(dailyReward(1), 20); assert.equal(dailyReward(7), 50); assert.equal(dailyReward(30), 50); });

test('achievements unlock from save progress and are reported once', () => {
  const S = { chapter: 2, mission: 0, stars: 10 };
  assert.deepEqual(newAchievements(S).map(a => a.id), ['misi1', 'bab1']);
  S.ach = { misi1: 1, bab1: 1 }; assert.deepEqual(newAchievements(S), []);
  S.stars = 50; S.talked = Object.fromEntries('abcdefghij'.split('').map(k => [k, 1])); assert.deepEqual(newAchievements(S).map(a => a.id), ['bintang50', 'kenal10']);
});
test('a brand-new save has no achievements; every achievement has a reward and bilingual title', () => {
  assert.deepEqual(newAchievements({ chapter: 1, mission: 0, stars: 0 }), []);
  for (const a of ACHIEVEMENTS) { assert.ok(a.rm > 0 && a.rm <= 150); assert.ok(a.bm && a.en); }
  assert.equal(new Set(ACHIEVEMENTS.map(a => a.id)).size, ACHIEVEMENTS.length);
});

let fail = 0;
for (const [n, fn] of tests) { try { await fn(); console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, '\n   ', e.message.split('\n')[0]); } }
console.log(`\n${tests.length - fail}/${tests.length} passed`); process.exit(fail ? 1 : 0);
