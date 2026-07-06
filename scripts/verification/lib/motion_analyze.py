"""Motion jank analyzer. Stage 2 of the motion verifier.

Reads a capture dir of frames + meta.json, measures the gap between the
screen-enter animation end (beacon) and content settle, applies thresholds,
and renders artifacts. Diff math is numpy; artifacts are ffmpeg.

Thresholds are INITIAL — the first real run calibrates them against measured
baselines. See docs/design/motion-jank-verifier.md.
"""
import numpy as np
from PIL import Image

# ── thresholds ───────────────────────────────────────────────────────────────
POPIN_GAP_MS = 100.0        # FAIL needs gap above this AND magnitude above the next
POPIN_MAG_PCT = 5.0         # ...and this % of content pixels changing after end
DROPPED_FRAME_RATIO = 0.20  # WARN above this
SETTLE_DELTA = 2.0          # mean abs RGB delta at/below which a region is settled
BEACON_DOMINANCE = 40       # channel-dominance margin for beacon classification


def load_frame(path):
    return np.asarray(Image.open(path).convert('RGB'), dtype=np.int16)


def crop(frame, box):
    x, y, w, h = box['x'], box['y'], box['width'], box['height']
    return frame[y:y + h, x:x + w, :]


def region_mean_delta(a, b, box):
    return float(np.abs(crop(a, box) - crop(b, box)).mean())


def region_changed_fraction(a, b, box, thr=20):
    diff = np.abs(crop(a, box) - crop(b, box)).max(axis=2)
    return float((diff > thr).mean() * 100.0)


def classify_beacon(frame, box, dominance=BEACON_DOMINANCE):
    s = crop(frame, box)
    r, g, b = float(s[..., 0].mean()), float(s[..., 1].mean()), float(s[..., 2].mean())
    if g - max(r, b) > dominance:
        return 'green'
    if r - max(g, b) > dominance:
        return 'red'
    return 'neutral'


def detect_animation_window(classes):
    start = next((i for i, c in enumerate(classes) if c == 'green'), None)
    if start is None:
        return None
    end = next((i for i, c in enumerate(classes) if c == 'red' and i > start), None)
    return (start, end)


def content_delta_series(frames, box):
    series = [0.0]
    for i in range(1, len(frames)):
        series.append(region_mean_delta(frames[i - 1], frames[i], box))
    return series


def detect_settle_idx(series, thr=SETTLE_DELTA):
    last = 0
    for i, d in enumerate(series):
        if d > thr:
            last = i
    return last


def verdict(m):
    if m.get('popinGapMs', 0) > POPIN_GAP_MS and m.get('lateChangePct', 0) > POPIN_MAG_PCT:
        return 'FAIL'
    if m.get('droppedFrameRatio', 0) > DROPPED_FRAME_RATIO:
        return 'WARN'
    return 'PASS'


def compute_metrics(meta, frames):
    beacon_box, content_box = meta['beaconBox'], meta['contentBox']
    tMs = [fr['tMs'] for fr in meta['frames']]
    classes = [classify_beacon(f, beacon_box) for f in frames]
    window = detect_animation_window(classes)
    series = content_delta_series(frames, content_box)
    settle_idx = detect_settle_idx(series)
    out = {'role': meta['role'], 'case': meta['case'], 'condition': meta['condition'],
           'reducedMotion': meta.get('reducedMotion', False),
           'declaredDurationMs': meta.get('declaredDurationMs'), 'frameCount': len(frames),
           'deltaSeries': [round(d, 2) for d in series], 'tMs': [round(t, 1) for t in tMs]}
    if window is None or window[1] is None:
        # No animation window seen. Expected under reduced-motion; a defect otherwise.
        out['popinGapMs'] = 0.0
        out['lateChangePct'] = 0.0
        out['droppedFrameRatio'] = 0.0
        out['animEndMs'] = None
        if meta.get('reducedMotion'):
            late = region_changed_fraction(frames[0], frames[-1], content_box) if len(frames) > 1 else 0.0
            out['lateChangePct'] = round(late, 2)
            out['verdict'] = 'PASS' if late < POPIN_MAG_PCT else 'FAIL'
        else:
            out['verdict'] = 'ERROR'
            out['error'] = 'beacon window not detected (screen-enter never fired?)'
        return out
    if meta.get('reducedMotion'):
        out['verdict'] = 'FAIL'
        out['error'] = 'motion detected under reduced-motion'
        out['animEndMs'] = round(tMs[window[0]], 1)
        out['popinGapMs'] = 0.0
        out['lateChangePct'] = 0.0
        out['droppedFrameRatio'] = 0.0
        return out
    s_idx, e_idx = window
    anim_start, anim_end, settle = tMs[s_idx], tMs[e_idx], tMs[settle_idx]
    popin = max(0.0, settle - anim_end)
    late_mag = region_changed_fraction(frames[e_idx], frames[-1], content_box)
    win_ts = tMs[s_idx:e_idx + 1]
    intervals = [win_ts[i] - win_ts[i - 1] for i in range(1, len(win_ts))]
    med = sorted(intervals)[len(intervals) // 2] if intervals else 0.0
    dropped = sum(1 for iv in intervals if med > 0 and iv > 1.8 * med)
    out.update({'animStartMs': round(anim_start, 1), 'animEndMs': round(anim_end, 1),
                'settleMs': round(settle, 1), 'measuredWindowMs': round(anim_end - anim_start, 1),
                'popinGapMs': round(popin, 1), 'lateChangePct': round(late_mag, 2),
                'droppedFrameRatio': round(dropped / len(intervals), 2) if intervals else 0.0})
    out['verdict'] = verdict(out)
    return out
