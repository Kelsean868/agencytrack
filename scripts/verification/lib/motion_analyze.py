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
