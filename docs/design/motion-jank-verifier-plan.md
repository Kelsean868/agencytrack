# Motion Jank Verifier — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only, on-demand verifier that measures the gap between a dashboard's `screen-enter` animation ending and its content actually settling — quantifying the "content pops in after the animation" jank — and emits watchable proof.

**Architecture:** Two stages joined by a file contract. Stage 1 (Node/Playwright) logs in per role against a Vercel preview, injects a top-of-viewport **beacon** strip that flips green→red on the screen-enter `animationstart`/`animationend`, captures CDP screencast frames (with real timestamps) through a **cold** then **warm** tab switch, and writes frames + `meta.json` per case. Stage 2 (Python/numpy/ffmpeg) frame-diffs the content region, finds the beacon window and the content-settle point, computes the pop-in metric, applies thresholds, and renders an annotated slow-mo + GIF + `summary.md`.

**Tech Stack:** Node ESM + Playwright + Chrome DevTools Protocol (screencast); Python 3 stdlib `unittest` + numpy + Pillow (diff math) + ffmpeg-python/ffmpeg (artifacts). Reuses `scripts/verification/lib/walk-helpers.mjs`.

## Global Constraints

- **Read-only.** Navigation + screen capture only. No Firestore writes, no rules/functions/index changes, no `src/` runtime changes. (Data-safety: nothing to mutate.)
- **Credentials by env-var name only.** Never echo `A11Y_*` / `VERCEL_BYPASS_TOKEN` values to chat, logs, PR, or artifacts. Reference by name.
- **CC never merges or deploys** (methodology Rule 19). Ends at PR-open + a diagnostic run report.
- Animation under test: `@keyframes screen-enter`, `--dur-3` = **320ms**, `ease-out cubic-bezier(.22,1,.36,1)`; `animationName === 'screen-enter'` is the filter.
- Thresholds (initial, first run calibrates): **FAIL** if `popinGapMs > 100` AND `lateChangePct > 5`; **WARN** if `droppedFrameRatio > 0.20`.
- Capture context: `deviceScaleFactor: 1`, `viewport: 1440×900` (sidebar visible, CSS px == device px so coordinates align).
- Output root: `scripts/verification/out/motion/<timestamp>/` — **gitignored** (added in Task 4).
- Python deps (numpy, Pillow, ffmpeg-python) confirmed present on the machine's Python 3.14; **no pip installs required**. Analyzer tests use stdlib `unittest` (no new dependency).
- Case table (nav labels verified from source):

  | role | envPrefix | defaultLabel | targetLabel |
  |---|---|---|---|
  | agent | `A11Y_AGENT` | Home | History |
  | branch_manager | `A11Y_BRANCH_MANAGER` | Overview | Team WARs |
  | tenant_admin | `A11Y_TENANT_ADMIN` | Dashboard | All Users |

## File Contract (meta.json — produced by Stage 1, consumed by Stage 2)

```json
{
  "role": "agent", "case": "history", "condition": "cold",
  "targetLabel": "History", "reducedMotion": false,
  "declaredDurationMs": 320.0,
  "viewport": { "width": 1440, "height": 900 },
  "beaconBox":  { "x": 0, "y": 0, "width": 1440, "height": 6 },
  "contentBox": { "x": 280, "y": 64, "width": 1160, "height": 820 },
  "frames": [ { "index": 1, "file": "frame_00001.jpg", "tMs": 0.0 }, { "index": 2, "file": "frame_00002.jpg", "tMs": 16.7 } ],
  "animation": { "startPerfMs": 1234.5, "endPerfMs": 1554.9 },
  "longTasks": [ { "startPerfMs": 1240.0, "durationMs": 90.0 } ],
  "url": "https://<preview>", "account": "A11Y_AGENT"
}
```

Frames are `frame_00001.jpg`… (1-indexed, zero-padded 5), JPEG, one per screencast frame. `tMs` is ms relative to the first captured frame (from CDP `metadata.timestamp`, seconds → ms). `beaconBox`/`contentBox` are in device pixels (== CSS px at DSF 1).

---

### Task 1: Analyzer — frame IO, region delta, beacon classification

**Files:**
- Create: `scripts/verification/lib/motion_analyze.py`
- Test: `scripts/verification/lib/test_motion_analyze.py`

**Interfaces:**
- Produces: `load_frame(path)->np.int16[H,W,3]`, `crop(frame,box)->ndarray`, `region_mean_delta(a,b,box)->float`, `region_changed_fraction(a,b,box,thr=20)->float` (percent), `classify_beacon(frame,box,dominance=40)->'green'|'red'|'neutral'`.

- [ ] **Step 1: Write the failing test**

```python
# scripts/verification/lib/test_motion_analyze.py
import unittest
import numpy as np
import motion_analyze as M

def solid(h, w, rgb):
    a = np.zeros((h, w, 3), dtype=np.int16)
    a[:, :] = rgb
    return a

class TestPrimitives(unittest.TestCase):
    def test_region_mean_delta_zero_for_identical(self):
        a = solid(10, 10, (100, 100, 100))
        self.assertEqual(M.region_mean_delta(a, a.copy(), {'x':0,'y':0,'width':10,'height':10}), 0.0)

    def test_region_mean_delta_counts_change(self):
        a = solid(10, 10, (0, 0, 0)); b = solid(10, 10, (10, 10, 10))
        self.assertAlmostEqual(M.region_mean_delta(a, b, {'x':0,'y':0,'width':10,'height':10}), 10.0)

    def test_changed_fraction_region_only(self):
        a = solid(10, 10, (0,0,0)); b = a.copy(); b[0:5, :, :] = 200  # half changed
        pct = M.region_changed_fraction(a, b, {'x':0,'y':0,'width':10,'height':10}, thr=20)
        self.assertAlmostEqual(pct, 50.0)

    def test_classify_beacon_green_red_neutral(self):
        box = {'x':0,'y':0,'width':8,'height':6}
        self.assertEqual(M.classify_beacon(solid(6,8,(0,200,0)), box), 'green')
        self.assertEqual(M.classify_beacon(solid(6,8,(200,0,0)), box), 'red')
        self.assertEqual(M.classify_beacon(solid(6,8,(0,0,0)), box), 'neutral')

if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/verification/lib && python -m unittest test_motion_analyze -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'motion_analyze'` (or AttributeError once the file exists but functions don't).

- [ ] **Step 3: Write minimal implementation**

```python
# scripts/verification/lib/motion_analyze.py
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
POPIN_GAP_MS = 100.0        # FAIL needs gap above this AND magnitude below
POPIN_MAG_PCT = 5.0         # ...and this % of content pixels changing after end
DROPPED_FRAME_RATIO = 0.20  # WARN above this
SETTLE_DELTA = 2.0          # mean abs RGB delta at/below which a region is settled
BEACON_DOMINANCE = 40       # channel-dominance margin for beacon classification

def load_frame(path):
    return np.asarray(Image.open(path).convert('RGB'), dtype=np.int16)

def crop(frame, box):
    x, y, w, h = box['x'], box['y'], box['width'], box['height']
    return frame[y:y+h, x:x+w, :]

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/verification/lib && python -m unittest test_motion_analyze -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/verification/lib/motion_analyze.py scripts/verification/lib/test_motion_analyze.py
git commit -m "feat(verifier): motion analyzer primitives (frame diff + beacon classify)"
```

---

### Task 2: Analyzer — window detection, settle, metrics, verdict

**Files:**
- Modify: `scripts/verification/lib/motion_analyze.py`
- Modify: `scripts/verification/lib/test_motion_analyze.py`

**Interfaces:**
- Consumes: Task 1 primitives.
- Produces: `detect_animation_window(classes)->(start,end|None)|None`, `content_delta_series(frames,box)->[float]`, `detect_settle_idx(series,thr=SETTLE_DELTA)->int`, `compute_metrics(meta,frames)->dict`, `verdict(m)->str`.

- [ ] **Step 1: Write the failing test** — a synthetic sequence with a KNOWN pop-in gap.

```python
# append to test_motion_analyze.py
class TestMetrics(unittest.TestCase):
    def _frames(self):
        # 10 frames, 100x50. Beacon strip = rows 0..5 (full width).
        # Content region = rows 6..49. Timeline @ ~16.7ms/frame.
        # green at f2 (animstart), red at f5 (animend). Content ramps (fade)
        # f2..f5, then a POP-IN at f8 (big content change after animend).
        box_beacon = {'x':0,'y':0,'width':100,'height':6}
        box_content = {'x':0,'y':6,'width':100,'height':44}
        frames, tMs = [], []
        for i in range(10):
            f = np.zeros((50,100,3), dtype=np.int16)
            # beacon
            if 2 <= i < 5: f[0:6,:,:] = (0,200,0)
            elif i >= 5:   f[0:6,:,:] = (200,0,0)
            # content: fade grey 0->120 over f2..f5, static after, POP at f8
            grey = 0
            if i >= 2: grey = min(120, (i-2)*40)
            f[6:50,:,:] = grey
            if i >= 8: f[20:44,:,:] = 220   # late content block paints in
            frames.append(f); tMs.append(round(i*16.7,1))
        meta = {'role':'agent','case':'history','condition':'cold',
                'declaredDurationMs':320.0,'beaconBox':box_beacon,'contentBox':box_content,
                'frames':[{'index':i+1,'file':f'frame_{i+1:05d}.jpg','tMs':tMs[i]} for i in range(10)]}
        return meta, frames

    def test_window_and_popin_recovered(self):
        meta, frames = self._frames()
        m = M.compute_metrics(meta, frames)
        # animation window: green f2 (idx2, 33.4ms) -> red f5 (idx5, 83.5ms)
        self.assertAlmostEqual(m['animEndMs'], 83.5, places=1)
        # content still changing at f8 (133.6ms) -> settle after animend -> positive gap
        self.assertGreater(m['popinGapMs'], 40.0)
        self.assertGreater(m['lateChangePct'], 5.0)
        self.assertEqual(m['verdict'], 'FAIL')

    def test_clean_transition_passes(self):
        meta, frames = self._frames()
        # remove the pop-in: no late block
        for i in range(8, 10):
            frames[i][20:44,:,:] = 120
        m = M.compute_metrics(meta, frames)
        self.assertLessEqual(m['popinGapMs'], 40.0)
        self.assertEqual(m['verdict'], 'PASS')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/verification/lib && python -m unittest test_motion_analyze.TestMetrics -v`
Expected: FAIL — `AttributeError: module 'motion_analyze' has no attribute 'compute_metrics'`.

- [ ] **Step 3: Write minimal implementation** — append to `motion_analyze.py`:

```python
def detect_animation_window(classes):
    start = next((i for i, c in enumerate(classes) if c == 'green'), None)
    if start is None:
        return None
    end = next((i for i, c in enumerate(classes) if c == 'red' and i > start), None)
    return (start, end)

def content_delta_series(frames, box):
    series = [0.0]
    for i in range(1, len(frames)):
        series.append(region_mean_delta(frames[i-1], frames[i], box))
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
        out['popinGapMs'] = 0.0; out['lateChangePct'] = 0.0; out['droppedFrameRatio'] = 0.0
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
        out['verdict'] = 'FAIL'; out['error'] = 'motion detected under reduced-motion'
        out['animEndMs'] = round(tMs[window[0]], 1); out['popinGapMs'] = 0.0; out['lateChangePct'] = 0.0
        out['droppedFrameRatio'] = 0.0
        return out
    s_idx, e_idx = window
    anim_start, anim_end, settle = tMs[s_idx], tMs[e_idx], tMs[settle_idx]
    popin = max(0.0, settle - anim_end)
    late_mag = region_changed_fraction(frames[e_idx], frames[-1], content_box)
    win_ts = tMs[s_idx:e_idx+1]
    intervals = [win_ts[i]-win_ts[i-1] for i in range(1, len(win_ts))]
    med = sorted(intervals)[len(intervals)//2] if intervals else 0.0
    dropped = sum(1 for iv in intervals if med > 0 and iv > 1.8*med)
    out.update({'animStartMs': round(anim_start,1), 'animEndMs': round(anim_end,1),
                'settleMs': round(settle,1), 'measuredWindowMs': round(anim_end-anim_start,1),
                'popinGapMs': round(popin,1), 'lateChangePct': round(late_mag,2),
                'droppedFrameRatio': round(dropped/len(intervals),2) if intervals else 0.0})
    out['verdict'] = verdict(out)
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/verification/lib && python -m unittest test_motion_analyze -v`
Expected: PASS (all tests — 4 from Task 1 + 2 metrics tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/verification/lib/motion_analyze.py scripts/verification/lib/test_motion_analyze.py
git commit -m "feat(verifier): motion window/settle/pop-in metrics + verdict (synthetic-ground-truth TDD)"
```

---

### Task 3: Analyzer — CLI entry, summary output, ffmpeg artifacts

**Files:**
- Modify: `scripts/verification/lib/motion_analyze.py`
- Modify: `scripts/verification/lib/test_motion_analyze.py`

**Interfaces:**
- Consumes: Task 2 `compute_metrics`.
- Produces: `analyze_case(case_dir)->dict` (loads meta+frames, computes, writes `case.json`, renders `clip.mp4`+`clip.gif`), `analyze_run(run_dir)->dict` (walks `<role>/<condition>/` case dirs, writes `summary.json`+`summary.md`), `main(argv)`. CLI: `python motion_analyze.py <run_dir>`.

- [ ] **Step 1: Write the failing test** — a fixture run dir on disk, assert summary structure.

```python
# append to test_motion_analyze.py
import os, json, tempfile
from PIL import Image as PILImage

class TestRun(unittest.TestCase):
    def _write_case(self, case_dir):
        os.makedirs(case_dir, exist_ok=True)
        meta = {'role':'agent','case':'history','condition':'cold','targetLabel':'History',
                'reducedMotion':False,'declaredDurationMs':320.0,
                'viewport':{'width':100,'height':50},
                'beaconBox':{'x':0,'y':0,'width':100,'height':6},
                'contentBox':{'x':0,'y':6,'width':100,'height':44},'frames':[],
                'animation':{'startPerfMs':0,'endPerfMs':83},'longTasks':[]}
        for i in range(10):
            f = np.zeros((50,100,3), dtype=np.uint8)
            if 2 <= i < 5: f[0:6,:,:] = (0,200,0)
            elif i >= 5:   f[0:6,:,:] = (200,0,0)
            if i >= 2: f[6:50,:,:] = min(120,(i-2)*40)
            if i >= 8: f[20:44,:,:] = 220
            name = f'frame_{i+1:05d}.jpg'
            PILImage.fromarray(f,'RGB').save(os.path.join(case_dir,name),quality=95)
            meta['frames'].append({'index':i+1,'file':name,'tMs':round(i*16.7,1)})
        json.dump(meta, open(os.path.join(case_dir,'meta.json'),'w'))

    def test_analyze_run_writes_summary(self):
        with tempfile.TemporaryDirectory() as run:
            self._write_case(os.path.join(run,'agent','cold'))
            res = M.analyze_run(run)
            self.assertTrue(os.path.exists(os.path.join(run,'summary.json')))
            self.assertTrue(os.path.exists(os.path.join(run,'summary.md')))
            self.assertEqual(len(res['cases']), 1)
            self.assertEqual(res['cases'][0]['verdict'], 'FAIL')
            self.assertTrue(os.path.exists(os.path.join(run,'agent','cold','case.json')))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/verification/lib && python -m unittest test_motion_analyze.TestRun -v`
Expected: FAIL — `AttributeError: module 'motion_analyze' has no attribute 'analyze_run'`.

- [ ] **Step 3: Write minimal implementation** — append to `motion_analyze.py`:

```python
import os, json, glob, subprocess, sys

def _render_artifacts(case_dir, meta, metrics):
    """Assemble frames -> 4x slow-mo mp4 + gif via ffmpeg. Best-effort; a failure
    here does not fail the analysis (artifacts are review aids, not the verdict)."""
    frames = sorted(glob.glob(os.path.join(case_dir, 'frame_*.jpg')))
    if not frames:
        return
    listfile = os.path.join(case_dir, '_frames.txt')
    tMs = [fr['tMs'] for fr in meta['frames']]
    durs = [max(0.001, (tMs[i+1]-tMs[i])/1000.0) for i in range(len(tMs)-1)] + [0.05]
    with open(listfile, 'w') as fh:
        for f, d in zip([os.path.basename(x) for x in frames], durs):
            fh.write(f"file '{f}'\nduration {d*4:.4f}\n")   # 4x slow-mo
        fh.write(f"file '{os.path.basename(frames[-1])}'\n")
    mp4 = os.path.join(case_dir, 'clip.mp4')
    gif = os.path.join(case_dir, 'clip.gif')
    try:
        subprocess.run(['ffmpeg','-y','-f','concat','-safe','0','-i',listfile,
                        '-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-pix_fmt','yuv420p',mp4],
                       cwd=case_dir, check=True, capture_output=True)
        subprocess.run(['ffmpeg','-y','-i',mp4,'-vf','fps=15,scale=480:-1:flags=lanczos',gif],
                       cwd=case_dir, check=True, capture_output=True)
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        metrics['artifactError'] = str(e)[:200]
    finally:
        if os.path.exists(listfile): os.remove(listfile)

def analyze_case(case_dir):
    meta = json.load(open(os.path.join(case_dir, 'meta.json')))
    frames = [load_frame(os.path.join(case_dir, fr['file'])) for fr in meta['frames']]
    metrics = compute_metrics(meta, frames)
    metrics['targetLabel'] = meta.get('targetLabel')
    _render_artifacts(case_dir, meta, metrics)
    json.dump(metrics, open(os.path.join(case_dir, 'case.json'), 'w'), indent=2)
    return metrics

def analyze_run(run_dir):
    cases = []
    for meta_path in sorted(glob.glob(os.path.join(run_dir, '*', '*', 'meta.json'))):
        cases.append(analyze_case(os.path.dirname(meta_path)))
    summary = {'run': os.path.basename(run_dir.rstrip('/\\')), 'cases': cases}
    json.dump(summary, open(os.path.join(run_dir, 'summary.json'), 'w'), indent=2)
    _write_summary_md(run_dir, cases)
    return summary

def _write_summary_md(run_dir, cases):
    lines = ['# Motion jank verifier — summary', '',
             '| role | case | cond | declared | measured | animEnd(ms) | settle(ms) | **pop-in gap** | late% | dropped | verdict |',
             '|---|---|---|---|---|---|---|---|---|---|---|']
    for c in cases:
        lines.append('| {role} | {case} | {condition} | {dec} | {meas} | {ae} | {st} | **{gap}** | {late} | {drop} | {verdict} |'.format(
            role=c['role'], case=c['case'], condition=c['condition'],
            dec=c.get('declaredDurationMs'), meas=c.get('measuredWindowMs'),
            ae=c.get('animEndMs'), st=c.get('settleMs'), gap=c.get('popinGapMs'),
            late=c.get('lateChangePct'), drop=c.get('droppedFrameRatio'), verdict=c['verdict']))
    lines += ['', '## Delta curves (shape distinguishes pop-in spike vs count-up ramp vs spinner)']
    for c in cases:
        lines.append(f"- **{c['role']}/{c['case']}/{c['condition']}** ({c['verdict']}): "
                     f"{' '.join(str(d) for d in c.get('deltaSeries', []))}")
    open(os.path.join(run_dir, 'summary.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

def main(argv):
    if len(argv) < 2:
        print('usage: python motion_analyze.py <run_dir>'); return 2
    res = analyze_run(argv[1])
    fails = [c for c in res['cases'] if c['verdict'] in ('FAIL', 'ERROR')]
    warns = [c for c in res['cases'] if c['verdict'] == 'WARN']
    print(f"analyzed {len(res['cases'])} case(s): "
          f"{len(fails)} FAIL/ERROR, {len(warns)} WARN. summary.md written.")
    return 1 if fails else 0

if __name__ == '__main__':
    sys.exit(main(sys.argv))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/verification/lib && python -m unittest test_motion_analyze -v`
Expected: PASS (all). The `TestRun` case exercises real ffmpeg artifact rendering — confirms ffmpeg wiring end-to-end.

- [ ] **Step 5: Commit**

```bash
git add scripts/verification/lib/motion_analyze.py scripts/verification/lib/test_motion_analyze.py
git commit -m "feat(verifier): analyzer CLI + summary.md + ffmpeg slow-mo/gif artifacts"
```

---

### Task 4: Node instrumentation module + gitignore

**Files:**
- Create: `scripts/verification/lib/motion-instrument.mjs`
- Modify: `.gitignore` (add `scripts/verification/out/`)

**Interfaces:**
- Produces: `installMotionInstrument` (function serialized into the page via `addInitScript`), `resetMotionMarks` (function run via `page.evaluate`), `MOTION_BEACON_ID`. In-page it maintains `window.__motionMarks = { declaredDurationMs, animation:{startPerfMs,endPerfMs}, longTasks:[], contentBox }` and a fixed 6px top beacon that flips `#00c800` on screen-enter `animationstart`, `#c80000` on `animationend`.

- [ ] **Step 1: Add the output dir to .gitignore**

Append to `.gitignore`:
```
# Motion verifier capture output (frames, artifacts) — never committed
scripts/verification/out/
```

- [ ] **Step 2: Write the instrumentation module**

```javascript
// scripts/verification/lib/motion-instrument.mjs
// Injected browser instrumentation for the motion jank verifier.
// The beacon converts the screen-enter animationstart/animationend DOM events
// into a pixel change the screencast can see — so animation timing lands on
// specific captured frames without any cross-clock math.

export const MOTION_BEACON_ID = '__motion_beacon__';

/** Runs in the page (via page.addInitScript). No external references. */
export function installMotionInstrument() {
  const BEACON_ID = '__motion_beacon__';
  const marks = { declaredDurationMs: null, animation: { startPerfMs: null, endPerfMs: null }, longTasks: [], contentBox: null };
  window.__motionMarks = marks;

  function beacon() {
    let el = document.getElementById(BEACON_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = BEACON_ID;
      // Appended to <html> so the screen-enter transform (on a <body> descendant) never fades or moves it.
      el.style.cssText = 'position:fixed;top:0;left:0;right:0;height:6px;z-index:2147483647;background:#000;pointer-events:none';
      document.documentElement.appendChild(el);
    }
    return el;
  }
  beacon();

  document.addEventListener('animationstart', function (e) {
    if (e.animationName !== 'screen-enter') return;
    beacon().style.background = '#00c800';
    marks.animation.startPerfMs = performance.now();
    try {
      marks.declaredDurationMs = parseFloat(getComputedStyle(e.target).animationDuration) * 1000;
      const r = e.target.getBoundingClientRect();
      marks.contentBox = { x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)), width: Math.round(r.width), height: Math.round(r.height) };
    } catch (_) {}
  }, true);

  document.addEventListener('animationend', function (e) {
    if (e.animationName !== 'screen-enter') return;
    beacon().style.background = '#c80000';
    marks.animation.endPerfMs = performance.now();
  }, true);

  try {
    new PerformanceObserver(function (list) {
      for (const entry of list.getEntries()) marks.longTasks.push({ startPerfMs: entry.startTime, durationMs: entry.duration });
    }).observe({ entryTypes: ['longtask'] });
  } catch (_) {}
}

/** Runs in the page (via page.evaluate) between cold and warm captures. */
export function resetMotionMarks() {
  if (window.__motionMarks) {
    window.__motionMarks.animation = { startPerfMs: null, endPerfMs: null };
    window.__motionMarks.longTasks = [];
    window.__motionMarks.contentBox = null;
  }
  const el = document.getElementById('__motion_beacon__');
  if (el) el.style.background = '#000';
}
```

- [ ] **Step 3: Syntax + export check**

Run: `node --input-type=module -e "import('./scripts/verification/lib/motion-instrument.mjs').then(m=>console.log(Object.keys(m).sort().join(',')))"`
Expected: `MOTION_BEACON_ID,installMotionInstrument,resetMotionMarks`

- [ ] **Step 4: Commit**

```bash
git add scripts/verification/lib/motion-instrument.mjs .gitignore
git commit -m "feat(verifier): screen-enter beacon instrumentation + gitignore capture output"
```

---

### Task 5: Node capture orchestrator

**Files:**
- Create: `scripts/verification/motion-verifier.mjs`

**Interfaces:**
- Consumes: `walk-helpers.mjs` (`setupBypassSession`, `loginAs`, `waitForLoaded`, `resolveSmokeBaseUrl`, `installGlobalTimeout`, `stamp`, `safeLog`); `motion-instrument.mjs`.
- CLI: `node scripts/verification/motion-verifier.mjs [--role agent|branch_manager|tenant_admin|all] [--reduced-motion] [--analyze-only <run_dir>] [--url <preview>]`. Writes `scripts/verification/out/motion/<stamp>/<role>/<cold|warm>/` then shells `python lib/motion_analyze.py <run_dir>`.

- [ ] **Step 1: Write the orchestrator**

```javascript
// scripts/verification/motion-verifier.mjs
// Stage 1 of the motion jank verifier: log in per role against a preview,
// instrument screen-enter, screencast a cold + warm tab switch, write frames +
// meta.json, then invoke the Python analyzer. READ-ONLY: navigation + capture.
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  setupBypassSession, loginAs, waitForLoaded, resolveSmokeBaseUrl,
  installGlobalTimeout, stamp, safeLog,
} from './lib/walk-helpers.mjs';
import { installMotionInstrument, resetMotionMarks } from './lib/motion-instrument.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CASES = {
  agent:          { envPrefix: 'A11Y_AGENT',          defaultLabel: 'Home',      targetLabel: 'History', case: 'history', loadedTestId: null },
  branch_manager: { envPrefix: 'A11Y_BRANCH_MANAGER', defaultLabel: 'Overview',  targetLabel: 'Team WARs', case: 'team-wars', loadedTestId: null },
  tenant_admin:   { envPrefix: 'A11Y_TENANT_ADMIN',   defaultLabel: 'Dashboard', targetLabel: 'All Users', case: 'all-users', loadedTestId: null },
};
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_CAP_MS = 1800;

function arg(name, def) { const i = process.argv.indexOf(name); return i > -1 ? (process.argv[i + 1] ?? true) : def; }
const wantRole = arg('--role', 'all');
const reducedMotion = process.argv.includes('--reduced-motion');

async function clickNavTab(page, label) {
  // nav items render label text as a clickable control (sidebar-link / button / link).
  const byRole = page.getByRole('button', { name: label, exact: true })
    .or(page.getByRole('link', { name: label, exact: true }));
  if (await byRole.count()) { await byRole.first().click(); return; }
  await page.locator('.sidebar-link', { hasText: label }).first().click();
}

async function captureSwitch(page, client, targetLabel) {
  const frames = [];
  let first = null;
  const onFrame = async (params) => {
    const ts = params.metadata.timestamp;
    if (first === null) first = ts;
    frames.push({ tMs: (ts - first) * 1000, data: params.data });
    await client.send('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => {});
  };
  client.on('Page.screencastFrame', onFrame);
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1, maxWidth: VIEWPORT.width, maxHeight: VIEWPORT.height });
  await clickNavTab(page, targetLabel);
  await page.waitForTimeout(SETTLE_CAP_MS);
  await client.send('Page.stopScreencast');
  client.off('Page.screencastFrame', onFrame);
  const marks = await page.evaluate(() => window.__motionMarks);
  return { frames, marks };
}

function writeCase(runDir, role, condition, cfg, cap, url, reduced) {
  const dir = path.join(runDir, role, condition);
  mkdirSync(dir, { recursive: true });
  const meta = {
    role, case: cfg.case, condition, targetLabel: cfg.targetLabel, reducedMotion: reduced,
    declaredDurationMs: cap.marks?.declaredDurationMs ?? null,
    viewport: VIEWPORT, beaconBox: { x: 0, y: 0, width: VIEWPORT.width, height: 6 },
    contentBox: cap.marks?.contentBox ?? { x: 0, y: 6, width: VIEWPORT.width, height: VIEWPORT.height - 6 },
    frames: [], animation: cap.marks?.animation ?? {}, longTasks: cap.marks?.longTasks ?? [],
    url, account: cfg.envPrefix,
  };
  cap.frames.forEach((f, i) => {
    const file = `frame_${String(i + 1).padStart(5, '0')}.jpg`;
    writeFileSync(path.join(dir, file), Buffer.from(f.data, 'base64'));
    meta.frames.push({ index: i + 1, file, tMs: Math.round(f.tMs * 10) / 10 });
  });
  writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  return meta.frames.length;
}

async function runRole(browser, role, baseUrl, token, runDir) {
  const cfg = CASES[role];
  const email = process.env[`${cfg.envPrefix}_EMAIL`];
  const password = process.env[`${cfg.envPrefix}_PASSWORD`];
  if (!email || !password) { safeLog(`SKIP ${role}: ${cfg.envPrefix}_EMAIL/PASSWORD not set`); return; }
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await setupBypassSession(context, baseUrl, token);
  const page = await context.newPage();
  await page.addInitScript(installMotionInstrument);
  await loginAs(page, baseUrl, email, password);
  await page.waitForTimeout(1500); // let the default tab settle before instrumenting the switch
  // COLD: default tab -> target (data likely unfetched)
  const client = await context.newCDPSession(page);
  const cold = await captureSwitch(page, client, cfg.targetLabel);
  const nCold = writeCase(runDir, role, 'cold', cfg, cold, baseUrl, reducedMotion);
  // WARM: back to default, reset, target again (data cached)
  await clickNavTab(page, cfg.defaultLabel);
  await page.waitForTimeout(800);
  await page.evaluate(resetMotionMarks);
  const warm = await captureSwitch(page, client, cfg.targetLabel);
  const nWarm = writeCase(runDir, role, 'warm', cfg, warm, baseUrl, reducedMotion);
  safeLog(`${role}: cold ${nCold} frames, warm ${nWarm} frames`);
  await context.close();
}

async function main() {
  const clearTimeout = installGlobalTimeout(180_000, () => { safeLog('TIMEOUT'); process.exit(2); });
  const analyzeOnly = arg('--analyze-only', null);
  const runDir = analyzeOnly || path.join(HERE, 'out', 'motion', stamp());
  if (!analyzeOnly) {
    const baseUrl = arg('--url', null) || resolveSmokeBaseUrl({ defaultHost: 'portal.agencytrack.app' });
    const token = process.env.VERCEL_BYPASS_TOKEN;
    const roles = wantRole === 'all' ? Object.keys(CASES) : [wantRole];
    mkdirSync(runDir, { recursive: true });
    const browser = await chromium.launch();
    try { for (const role of roles) await runRole(browser, role, baseUrl, token, runDir); }
    finally { await browser.close(); }
  }
  safeLog(`analyzing ${runDir}`);
  const py = spawnSync('python', [path.join(HERE, 'lib', 'motion_analyze.py'), runDir], { stdio: 'inherit' });
  clearTimeout();
  process.exit(py.status ?? 0);
}
main().catch((e) => { safeLog('FATAL ' + (e?.message || e)); process.exit(2); });
```

- [ ] **Step 2: Arg-parse + module-load check (no browser)**

Run: `node scripts/verification/motion-verifier.mjs --analyze-only scripts/verification/lib/__nonexistent__ 2>&1 | head -5`
Expected: it resolves imports, logs `analyzing …__nonexistent__`, and the Python analyzer prints `analyzed 0 case(s)…` (empty dir → no cases). Confirms the Node→Python wiring and imports resolve without launching a browser.

- [ ] **Step 3: Commit**

```bash
git add scripts/verification/motion-verifier.mjs
git commit -m "feat(verifier): capture orchestrator (per-role login, CDP screencast, cold/warm)"
```

---

### Task 6: SMOKES.md catalog + first real diagnostic run (acceptance / Phase 3)

**Files:**
- Modify: `scripts/verification/SMOKES.md`

- [ ] **Step 1: Catalog the verifier** — add a row/section to `scripts/verification/SMOKES.md` describing `motion-verifier.mjs`: purpose (screen-enter pop-in / jank), invocation (`node scripts/verification/motion-verifier.mjs --role all --url <preview>`), env needed (`VERCEL_BYPASS_TOKEN`, `A11Y_{AGENT,BRANCH_MANAGER,TENANT_ADMIN}_{EMAIL,PASSWORD}`), output (`scripts/verification/out/motion/<stamp>/summary.md` + per-case `clip.gif`), and that it is read-only + on-demand (not CI-wired).

- [ ] **Step 2: Commit the catalog**

```bash
git add scripts/verification/SMOKES.md
git commit -m "docs(verifier): catalog motion-verifier in SMOKES.md"
```

- [ ] **Step 3: Push + get preview URL**

```bash
git push -u origin feat/motion-verifier
```
Then read the preview URL from the GitHub deployment status (per CLAUDE.md; the branch alias `agencytrack-git-feat-motion-verifier-kyron-marchan-s-projects` is 61 chars ≤ 63, so it resolves — otherwise fall back to the immutable per-deployment URL from `gh api repos/{owner}/{repo}/deployments`).

- [ ] **Step 4: Acceptance run (Rule 5 — real invocation).** From a worktree with `.env.local` present (main worktree, or `cp ../AgencyTrack/.env.local .`):

Run: `node scripts/verification/motion-verifier.mjs --role all --url <preview>`
Expected (Phase-3 gate — all four must hold or STOP and surface): (a) each role logs in; (b) each case captures ≥ ~8 frames; (c) the beacon flip is visible (analyzer does **not** report `beacon window not detected`); (d) `summary.md` is written with a metric row per case.

- [ ] **Step 5: Read the diagnostic + report (do NOT merge).** Open `summary.md` + the cold `clip.gif` per role. Report: the pop-in gap per role, cold-vs-warm contrast (confirms/falsifies the async-content hypothesis), and any WARN dropped-frame findings. Update the PR description with the numbers. Then STOP — dispatcher merges (Rule 19).

- [ ] **Step 6: Optional reduced-motion pass** (if requested): `node scripts/verification/motion-verifier.mjs --role all --reduced-motion --url <preview>` — expect every case `PASS` (no window detected, low late-change); any `FAIL` = motion leaking past `prefers-reduced-motion`.

---

## Self-Review

**Spec coverage:**
- Beacon-aligned pixel capture → Tasks 4 (beacon) + 5 (screencast). ✓
- Pop-in gap = settle − animationEnd → Task 2 `compute_metrics`. ✓
- Late-change magnitude + delta-curve-shape confound handling → Task 2 (`region_changed_fraction`) + Task 3 (`summary.md` curves). ✓
- Cold-vs-warm contrast → Task 5 `runRole`. ✓
- Declared-duration cross-check + longtasks → instrument marks (Task 4), surfaced in meta. ✓
- Three roles via A11Y creds → CASES table (Global Constraints + Task 5). ✓
- Two-stage Node→Python split → Tasks 1-3 (Python) + 5 (Node shells Python). ✓
- ffmpeg slow-mo + GIF artifacts → Task 3 `_render_artifacts`. ✓
- Thresholds + verdict (FAIL/WARN/PASS) → Task 2 `verdict`. ✓
- reduced-motion optional flag → Task 5 (`--reduced-motion`) + Task 2 (inverted verdict) + Task 6 Step 6. ✓
- Read-only / no-merge → Global Constraints + Task 6 Step 5. ✓
- Output gitignored → Task 4. ✓
- Phase-3 real-invocation acceptance → Task 6 Step 4. ✓

**Placeholder scan:** No TBD/TODO; every code step carries complete code. SMOKES.md prose (Task 6 Step 1) is a doc edit, content specified.

**Type consistency:** `meta.json` keys are identical across the instrument (Task 4 `__motionMarks`), writer (Task 5 `writeCase`), and reader (Task 2/3 `compute_metrics`/`analyze_case`): `beaconBox`, `contentBox`, `frames[].tMs`, `declaredDurationMs`, `animation`, `longTasks`, `reducedMotion`. Function names consistent: `compute_metrics`, `analyze_case`, `analyze_run`, `installMotionInstrument`, `resetMotionMarks`, `clickNavTab`, `captureSwitch`, `writeCase`, `runRole`.
