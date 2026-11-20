// DOMPET RM — the game's single wallet. Every reward pays Ringgit (RM); every purchase goes through spend().
// The balance lives in S.coins (kept for old saves: 1 old coin = RM1). There is no server, so validation is local:
// amounts must be positive integers, the balance can never go below zero, and an item key can only be bought once.
// A small ledger (last 60 entries) is kept in S.ledger. To move to a server later, replace earn()/spend() with API calls.
import { S, save, sfx } from './core.js';

export const fmtRM = (n) => `RM${Math.round(n).toLocaleString('en-MY')}`;
const listeners = new Set();
export function onWallet(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function changed(kind, amt, why) { for (const fn of listeners) try { fn(kind, amt, why); } catch { } }
function log(kind, amt, why) { const L = (S.ledger ||= []); L.push({ t: Date.now(), kind, amt, why }); if (L.length > 60) L.splice(0, L.length - 60); }

export const balance = () => Math.max(0, Math.floor(S.coins || 0));
export const canAfford = (n) => Number.isFinite(n) && n >= 0 && balance() >= n;
export const owns = (key) => !!(S.owned && S.owned[key]);

// pay the player (rewards, prizes, sales). Returns the amount actually added.
export function earn(amount, why = '') {
  const n = Math.floor(Number(amount)); if (!Number.isFinite(n) || n <= 0) return 0;
  S.coins = balance() + n; log('earn', n, why); save(); try { sfx.coin(); } catch { } changed('earn', n, why); return n;
}
// charge the player. key (optional) marks a one-time purchase: it can never be bought twice.
// Returns { ok, reason } — reasons: 'invalid', 'owned', 'funds'.
export function spend(amount, why = '', key = null) {
  const n = Math.floor(Number(amount)); if (!Number.isFinite(n) || n < 0) return { ok: false, reason: 'invalid' };
  if (key && owns(key)) return { ok: false, reason: 'owned' };
  if (balance() < n) return { ok: false, reason: 'funds', short: n - balance() };
  S.coins = balance() - n; if (key) (S.owned ||= {})[key] = Date.now();
  log('spend', n, why); save(); changed('spend', n, why); return { ok: true };
}
// mark an item owned without paying (starter vehicles, gifts)
export function grant(key) { (S.owned ||= {})[key] = (S.owned && S.owned[key]) || Date.now(); save(); }
