/**
 * recruitingService.js — item 2.2 Monthly Recruiting kanban pipeline (CRM).
 *
 * Collection: /tenants/{tid}/recruitingCandidates/{autoId}
 * Contract locked in firestore.rules (commit f9829645): managers only; creator
 * self-owns (ownerUid == own uid); owner edits but CANNOT change ownerUid; an
 * in-scope senior (BM same-branch / SM+ / TA) may edit AND reassign ownerUid.
 * branchId + tenantId immutable in v1. No delete — candidates leave the board
 * via status='archived'.
 *
 * Board reads are EQUALITY-ONLY (single-field auto-indexes, NO composite):
 *  - UM (rank 1):  where('ownerUid','==',uid)
 *  - BM (rank 2):  where('branchId','==',ownBranchId)
 *  - SM+/TA (≥3):  unfiltered collection
 * status=='active' is filtered CLIENT-SIDE (a where on status would change the
 * list-rule/index calculus). Boards are tens of docs — client-side sort is fine.
 *
 * Every write must satisfy the rule's validCandidateWrite() hasAll() floor —
 * because updateDoc() merges, the merged request.resource.data retains all keys,
 * so partial updates are contract-safe as long as no required key is removed.
 */

import {
  addDoc, updateDoc, doc, collection, getDocs, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getWarRoleRank } from './managerWarService';

// ── Pipeline stages (ordered) — mirrors the recruiting-v2 mockup REC_STAGES ──
// The final stage (licensed) is the only one that counts as a HIRE; it feeds
// the manager's Weekly WAR "Recruiting" KPI.
export const RECRUITING_STAGES = [
  { key: 'sourced',    label: 'Sourced',          short: 'Sourced' },
  { key: 'contacted',  label: 'Contacted',        short: 'Contacted' },
  { key: 'seminar',    label: 'Career seminar',   short: 'Seminar' },
  { key: 'interview',  label: 'Interview',        short: 'Interview' },
  { key: 'assessment', label: 'Assessment',       short: 'Assessment' },
  { key: 'offer',      label: 'Offer / contracted', short: 'Offer' },
  { key: 'licensing',  label: 'In licensing',     short: 'Licensing' },
  { key: 'licensed',   label: 'Licensed & active', short: 'Licensed' },
];

export const STAGE_KEYS = RECRUITING_STAGES.map((s) => s.key);

export function stageIndex(key) {
  return RECRUITING_STAGES.findIndex((s) => s.key === key);
}

/**
 * 'stalled' is DERIVED client-side: an active candidate whose current stage has
 * not changed in more than STALLED_THRESHOLD_DAYS, excluding the terminal
 * 'licensed' stage. 14 days is CC-chosen (the mockup flags a 16-day 'contacted'
 * as stalled); it is operator-tunable via this single named constant.
 */
export const STALLED_THRESHOLD_DAYS = 14;

// ── Timestamp helpers — read Firestore Timestamp | Date | epoch-ms defensively.
export function toMillis(ts) {
  if (ts == null) return null;
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return null;
}

/** Whole days elapsed since `ts` (floored, clamped ≥ 0). null when unknowable. */
export function daysSince(ts, now = Date.now()) {
  const ms = toMillis(ts);
  if (ms == null) return null;
  return Math.max(0, Math.floor((now - ms) / 86_400_000));
}

/** Days the candidate has sat in its current stage (from stageChangedAt). */
export function daysInStage(candidate, now = Date.now()) {
  return daysSince(candidate?.stageChangedAt, now);
}

/** Derived stalled flag — active, non-licensed, stageChangedAt older than 14d. */
export function isStalled(candidate, now = Date.now()) {
  if (!candidate || candidate.status !== 'active') return false;
  if (candidate.stage === 'licensed') return false;
  const d = daysInStage(candidate, now);
  return d != null && d > STALLED_THRESHOLD_DAYS;
}

// ── String discipline ───────────────────────────────────────────────────────
function trimStr(v, max) {
  const s = String(v ?? '').trim();
  return max ? s.slice(0, max) : s;
}

// ── Write paths ─────────────────────────────────────────────────────────────

/**
 * Create a candidate. Creator self-owns: ownerUid is pinned to meta.ownerUid
 * (the caller's live uid) so the rule's `ownerUid == request.auth.uid` holds.
 * @returns {Promise<string>} the new candidate document id.
 */
export async function createCandidate(tenantId, data, meta) {
  const { branchId, ownerUid, ownerName } = meta;
  const coll = collection(db, `tenants/${tenantId}/recruitingCandidates`);
  const ref = await addDoc(coll, {
    tenantId,
    branchId:      trimStr(branchId),
    ownerUid,
    ownerName:     trimStr(ownerName, 200),
    name:          trimStr(data.name, 200),
    stage:         STAGE_KEYS.includes(data.stage) ? data.stage : 'sourced',
    status:        'active',
    source:        trimStr(data.source, 200),
    referrerName:  trimStr(data.referrerName, 200),
    note:          trimStr(data.note, 2000),
    ...(trimStr(data.phone) ? { phone: trimStr(data.phone, 40) } : {}),
    stageChangedAt: serverTimestamp(),
    lastTouchAt:    serverTimestamp(),
    createdAt:      serverTimestamp(),
    updatedAt:      serverTimestamp(),
  });
  return ref.id;
}

function candidateRef(tenantId, candidateId) {
  return doc(db, `tenants/${tenantId}/recruitingCandidates/${candidateId}`);
}

/**
 * Owner-safe field edit (name / source / referrerName / note / stage). NEVER
 * includes ownerUid — the rule's owner arm requires ownerUid to be unchanged,
 * and reassignment goes through reassignCandidate() (senior-only). Guard: even
 * if a caller passes ownerUid in `patch`, it is stripped here.
 */
export async function updateCandidate(tenantId, candidateId, patch) {
  const { ownerUid: _drop, tenantId: _t, branchId: _b, ...rest } = patch;
  const clean = {};
  if (rest.name         !== undefined) clean.name         = trimStr(rest.name, 200);
  if (rest.source       !== undefined) clean.source       = trimStr(rest.source, 200);
  if (rest.referrerName !== undefined) clean.referrerName = trimStr(rest.referrerName, 200);
  if (rest.note         !== undefined) clean.note         = trimStr(rest.note, 2000);
  if (rest.stage        !== undefined && STAGE_KEYS.includes(rest.stage)) clean.stage = rest.stage;
  await updateDoc(candidateRef(tenantId, candidateId), {
    ...clean,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Move a candidate to a new stage: bumps stageChangedAt (resets days-in-stage
 * and the stalled clock) + lastTouchAt + updatedAt. When moving to 'licensed'
 * also stamps licensedAt (the hire moment; optional extra key, allowed by the
 * rule's hasAll floor).
 */
export async function moveCandidateStage(tenantId, candidateId, newStage) {
  if (!STAGE_KEYS.includes(newStage)) {
    throw new Error(`Invalid recruiting stage: ${newStage}`);
  }
  const now = serverTimestamp();
  await updateDoc(candidateRef(tenantId, candidateId), {
    stage:          newStage,
    stageChangedAt: now,
    lastTouchAt:    now,
    updatedAt:      now,
    ...(newStage === 'licensed' ? { licensedAt: now } : {}),
  });
}

/** Log a touch — bumps lastTouchAt (activity signal) without changing stage. */
export async function logTouch(tenantId, candidateId) {
  const now = serverTimestamp();
  await updateDoc(candidateRef(tenantId, candidateId), {
    lastTouchAt: now,
    updatedAt:   now,
  });
}

/**
 * Reassign ownership (senior-only — BM same-branch / SM+ / TA per the rule's
 * seniorInScope()). Sets ownerUid + ownerName; the caller-role gate is enforced
 * by the UI (senior-only affordance) AND by the rule.
 */
export async function reassignCandidate(tenantId, candidateId, { ownerUid, ownerName }) {
  await updateDoc(candidateRef(tenantId, candidateId), {
    ownerUid,
    ownerName: trimStr(ownerName, 200),
    updatedAt: serverTimestamp(),
  });
}

/** Archive — the only removal path (no hard delete). status='archived'. */
export async function archiveCandidate(tenantId, candidateId) {
  await updateDoc(candidateRef(tenantId, candidateId), {
    status:    'archived',
    updatedAt: serverTimestamp(),
  });
}

// ── Read path — role-split board query ──────────────────────────────────────

/**
 * Fetch candidates for the pipeline board, split by role per the locked rule:
 *  - UM (rank 1):  own candidates       → where('ownerUid','==',ownerUid)
 *  - BM (rank 2):  own branch           → where('branchId','==',branchId)
 *  - SM+/TA (≥3):  tenant-wide          → unfiltered collection
 * Returns ALL docs (active + archived); callers filter status client-side.
 */
export async function getCandidatesForBoard({ tenantId, role, branchId, ownerUid }) {
  const coll = collection(db, `tenants/${tenantId}/recruitingCandidates`);
  const rank = getWarRoleRank(role);
  let q;
  if (rank >= 3) {
    q = query(coll);
  } else if (rank === 2) {
    q = query(coll, where('branchId', '==', branchId));
  } else {
    q = query(coll, where('ownerUid', '==', ownerUid));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
