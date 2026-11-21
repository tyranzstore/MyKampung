// Achievements and the daily login reward. Pure functions over the save (S) so they can be tested in Node.
// Rewards are small and cosmetic-free: no pay-to-win. Online, the server decides the daily reward (server/economy.js).

// Achievement list: id, title (BM · EN), reward in RM, and a test over the save.
export const ACHIEVEMENTS = [
  { id: 'misi1', bm: 'Langkah pertama', en: 'First step', rm: 20, ok: (S) => S.chapter > 1 || S.mission >= 1 },
  { id: 'bab1', bm: 'Pulang ke kampung', en: 'Chapter 1 done', rm: 50, ok: (S) => S.chapter >= 2 },
  { id: 'bab3', bm: 'Anak laut', en: 'Chapter 3 done', rm: 80, ok: (S) => S.chapter >= 4 },
  { id: 'bab5', bm: 'Wira kampung', en: 'Chapter 5 done', rm: 150, ok: (S) => S.chapter >= 6 || !!S.festivalDone },
  { id: 'bintang50', bm: '50 bintang', en: '50 stars', rm: 50, ok: (S) => (S.stars || 0) >= 50 },
  { id: 'ikan10', bm: 'Pemancing', en: '10 fish species', rm: 60, ok: (S) => Object.keys(S.fishLog || {}).length >= 10 },
  { id: 'kenderaan', bm: 'Ada kenderaan', en: 'Own a vehicle', rm: 30, ok: (S) => Object.keys(S.owned || {}).some(k => k.startsWith('veh')) },
  { id: 'kenal10', bm: 'Kenal semua', en: 'Talk to 10 villagers', rm: 40, ok: (S) => Object.keys(S.talked || {}).length >= 10 },
  { id: 'streak7', bm: 'Setia seminggu', en: '7-day login streak', rm: 70, ok: (S) => ((S.login || {}).streak || 0) >= 7 },
];

// Newly reached achievements (not yet recorded in S.ach). The caller records them and pays the reward.
export function newAchievements(S) { const got = S.ach || {}; return ACHIEVEMENTS.filter(a => !got[a.id] && a.ok(S)); }

// Malaysian calendar day (UTC+8), so the day rolls over at local midnight for every player.
export const myDay = (ms) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);
export const dailyReward = (streak) => 20 + 5 * (Math.min(streak, 7) - 1); // RM20 on day 1 … RM50 from day 7

// Offline daily login. Anti-abuse: one claim per Malaysian calendar day, and no claim if the device clock
// is earlier than the last claim (turning the clock back). Returns { ok, reward, streak } or { ok:false, reason }.
export function claimDaily(S, now = Date.now()) {
  const L = S.login || {}; const day = myDay(now);
  if (L.lastTs && now < L.lastTs - 5 * 60e3) return { ok: false, reason: 'clock' };
  if (L.day === day) return { ok: false, reason: 'claimed' };
  const yesterday = myDay(now - 86400e3);
  const streak = L.day === yesterday ? (L.streak || 0) + 1 : 1;
  S.login = { day, lastTs: now, streak };
  return { ok: true, reward: dailyReward(streak), streak };
}
