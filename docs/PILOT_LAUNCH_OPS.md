# Pilot Launch Operations

Operational reference for deploying and running AgencyTrack in a live branch environment.

---

## TV Display Setup

The kiosk route (`/kiosk/:tenantId/:token`) is a public, token-gated page designed for always-on office TV displays.

### Generating a kiosk token

1. Log in as Branch Manager or higher
2. Go to Manager Dashboard → Kiosk tab
3. Click "Generate Kiosk URL"
4. Copy the URL shown — it embeds the token

Tokens do not expire unless manually revoked from the same tab.

### Revoking a token

From Manager Dashboard → Kiosk tab → "Revoke" button. The display will show "Display unavailable" on its next refresh (within 5 minutes).

---

### Dedicated TV display (recommended for branch office)

For a TV that runs the kiosk permanently, launch Chrome with the `--kiosk` flag so the browser starts full-screen with no address bar, toolbars, or exit UI.

**Windows:**
```
chrome.exe --kiosk "https://agencytrack.vercel.app/kiosk/<tenantId>/<token>"
```

**Linux / Raspberry Pi (Chromium):**
```
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  "https://agencytrack.vercel.app/kiosk/<tenantId>/<token>"
```

**macOS:**
```
open -a "Google Chrome" --args --kiosk \
  "https://agencytrack.vercel.app/kiosk/<tenantId>/<token>"
```

Replace `<tenantId>` and `<token>` with the values from the generated URL.

### Recommended dedicated kiosk hardware

| Option | Approx. cost (TTD) | Notes |
|---|---|---|
| Raspberry Pi 4 (4 GB) | ~$600 incl. cables | Best for permanently-mounted TVs |
| Mini-PC (Intel N-series) | ~$1,500 | More headroom, quieter |

Configure auto-launch on boot:

- **Raspberry Pi / Linux:** systemd service that runs the Chromium command above after the desktop starts
- **Windows:** Task Scheduler → On Logon → run the `chrome.exe --kiosk ...` command

---

### Occasional-use display (laptop / tablet)

When a manager opens the kiosk on a laptop that is not dedicated, the on-screen "Enter fullscreen" button appears at the bottom-right corner. Click it to activate the browser Fullscreen API. Press `Esc` to exit fullscreen.

---

## Data refresh cadence

The kiosk polls Firestore every 5 minutes. Data shown is at most 5 minutes stale. No manual refresh is needed.

---

## Troubleshooting

| Symptom | Likely cause | Resolution |
|---|---|---|
| "Display unavailable" | Token revoked or invalid URL | Re-generate token from Manager Dashboard |
| Blank screen / spinner | Network issue or Firestore cold start | Wait 30 s; reload if persistent |
| Wrong branch data | Token was generated for a different branch | Revoke and re-generate |
| Kiosk exits fullscreen (dedicated TV) | OS update / sleep policy | Use `--kiosk` Chrome flag; disable sleep in OS power settings |
