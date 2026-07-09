/**
 * celebrationPrefs.js — per-uid "already celebrated" markers, persisted to
 * localStorage. Keeps milestone takeovers firing ONCE (per run / per year)
 * without any Firestore write. All access is try/catch-guarded: localStorage
 * throws in private-mode / disabled-storage, and a celebration marker must
 * never break a save or a page render.
 *
 * Keys are namespaced + uid-scoped so multiple agents on a shared device never
 * collide. A missing/failed read returns the safe default (0 / not-celebrated),
 * which means "eligible to celebrate".
 */

const NS = 'agencytrack:celebrations';

function readInt(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 0;
    const raw = window.localStorage.getItem(key);
    const n = parseInt(raw ?? '', 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeInt(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable — celebration will simply be eligible again */
  }
}

function readFlag(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, '1');
  } catch {
    /* storage unavailable */
  }
}

// ── Daily logging streak ────────────────────────────────────────────────────

const dailyStreakKey = (uid) => `${NS}:dailyStreakMax:${uid}`;

export function getDailyStreakCelebratedMax(uid) {
  return readInt(dailyStreakKey(uid));
}

export function setDailyStreakCelebratedMax(uid, value) {
  writeInt(dailyStreakKey(uid), Number(value) || 0);
}

// ── Goals surface (annual + weekly-target streak), scoped per year ──────────

const goalsAnnualKey = (uid, year) => `${NS}:goalsAnnual:${uid}:${year}`;
const goalsStreakKey = (uid, year) => `${NS}:goalsStreakMax:${uid}:${year}`;

export function getGoalsCelebrated(uid, year) {
  return {
    annual: readFlag(goalsAnnualKey(uid, year)),
    streakMax: readInt(goalsStreakKey(uid, year)),
  };
}

export function setGoalsAnnualCelebrated(uid, year) {
  writeFlag(goalsAnnualKey(uid, year));
}

export function setGoalsStreakCelebratedMax(uid, year, value) {
  writeInt(goalsStreakKey(uid, year), Number(value) || 0);
}
