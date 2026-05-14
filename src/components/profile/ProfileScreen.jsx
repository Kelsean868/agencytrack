import React, { useState, useRef } from 'react';
import { Camera, Save, AlertCircle, User, CalendarClock, LogOut, Pencil } from 'lucide-react';
import SaveButton from '../ui/SaveButton';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../utils/formatters';
import { updateUserProfile, compressImage, uploadProfilePhoto } from '../../services/userService';
import { signOut } from '../../services/authService';
import EmailUpdateModal from './EmailUpdateModal';
import {
  aggregateCurrentWeekDaily,
  catchUpWeeklyToDaily,
} from '../../services/loggingModeService';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const BIO_MAX   = 200;

export default function ProfileScreen() {
  const { user, userProfile, role, tenantId } = useAuth();

  const [displayName,     setDisplayName]     = useState(userProfile?.name ?? '');
  const [phone,           setPhone]           = useState(userProfile?.phone ?? '');
  const [bio,             setBio]             = useState(userProfile?.bio ?? '');
  const [unitName,        setUnitName]        = useState(userProfile?.unitName ?? '');
  const [photoURL,        setPhotoURL]        = useState(userProfile?.photoURL ?? null);
  const [uploadProgress,  setUploadProgress]  = useState(null); // null | 0–100
  const [saving,          setSaving]          = useState(false);
  const [savedAt,         setSavedAt]         = useState(null);
  const [error,           setError]           = useState(null);
  const [emailModalOpen,  setEmailModalOpen]  = useState(false);

  // E6 logging mode panel state
  const [loggingMode,    setLoggingMode]    = useState(userProfile?.loggingMode ?? 'hybrid');
  const [dailyNudgeTime, setDailyNudgeTime] = useState(userProfile?.dailyNudgeTime ?? '17:00');
  const [pendingMode,    setPendingMode]    = useState(null); // 'weekly' | 'daily' | null
  const [modeSaving,     setModeSaving]     = useState(false);
  const [modeMessage,    setModeMessage]    = useState(null);

  const fileInputRef = useRef(null);

  const roleLabel  = getRoleLabel(role);
  const joinDate   = userProfile?.createdAt?.toDate?.()?.toLocaleDateString('en-TT') ?? '—';
  const email      = userProfile?.email ?? user?.email ?? '—';

  // ── Photo upload ────────────────────────────────────────────────────────
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please select a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be under 2 MB. Please choose a smaller file.');
      return;
    }

    try {
      setUploadProgress(0);
      const compressed = await compressImage(file, 400);
      const url = await uploadProfilePhoto(tenantId, user.uid, compressed, (pct) => {
        setUploadProgress(pct);
      });
      setPhotoURL(url);
      setUploadProgress(null);
    } catch (err) {
      console.error(err);
      setError('Photo upload failed. Please try again.');
      setUploadProgress(null);
    }
  }

  // ── E6 logging mode save ──────────────────────────────────────────────
  // Direct save for: hybrid switches, weekly→hybrid, daily→hybrid,
  // nudge-time-only changes, and any switch that doesn't risk data loss.
  // Switches involving weekly→daily or daily→weekly mid-week trigger a
  // confirmation flow (see handleModeSelect / handleConfirmMode).
  const persistModeSettings = async (modeToSave) => {
    setModeSaving(true);
    setModeMessage(null);
    try {
      await updateUserProfile(tenantId, user.uid, {
        loggingMode: modeToSave,
        dailyNudgeTime,
      });
      setLoggingMode(modeToSave);
      setPendingMode(null);
    } catch (err) {
      console.error(err);
      setModeMessage({ kind: 'error', text: 'Could not save logging mode.' });
    } finally {
      setModeSaving(false);
    }
  };

  const todayLocalDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Called when the agent picks a different radio option.
  const handleModeSelect = (next) => {
    if (next === loggingMode) return;
    // Mid-week catch-up paths require confirmation.
    if (loggingMode === 'weekly' && next === 'daily') {
      setPendingMode('daily');
      return;
    }
    if (loggingMode === 'daily' && next === 'weekly') {
      setPendingMode('weekly');
      return;
    }
    persistModeSettings(next);
  };

  const handleConfirmMode = async () => {
    if (!pendingMode) return;
    setModeSaving(true);
    setModeMessage(null);
    const agentName = userProfile?.name ?? userProfile?.email ?? '';
    try {
      if (pendingMode === 'daily') {
        const result = await catchUpWeeklyToDaily(tenantId, user.uid, agentName, todayLocalDate());
        if (result.catchUp) {
          setModeMessage({
            kind: 'info',
            text: `Your weekly draft was carried over as a single catch-up entry for today (${result.today}). Future days log per-day.`,
          });
        }
      } else if (pendingMode === 'weekly') {
        const result = await aggregateCurrentWeekDaily(
          tenantId,
          user.uid,
          agentName,
          userProfile?.commissionRate ?? 0,
          userProfile?.unitId ?? null
        );
        if (result.aggregated) {
          setModeMessage({
            kind: 'info',
            text: `Your ${result.count} daily ${result.count === 1 ? 'entry was' : 'entries were'} summed into the weekly draft for review.`,
          });
        } else if (result.alreadySubmitted) {
          setModeMessage({
            kind: 'info',
            text: 'This week was already submitted — no carry-over needed.',
          });
        }
      }
      await persistModeSettings(pendingMode);
    } catch (err) {
      console.error(err);
      setModeMessage({ kind: 'error', text: 'Mode switch failed. Please try again.' });
      setModeSaving(false);
    }
  };

  const handleCancelModeSwitch = () => {
    setPendingMode(null);
    setModeMessage(null);
  };

  const handleSaveNudgeTime = async () => {
    await persistModeSettings(loggingMode);
  };

  // ── Profile save ────────────────────────────────────────────────────────
  async function handleSave() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const fields = {
        name: displayName.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
      };
      if (role === 'unit_manager') fields.unitName = unitName.trim();
      await updateUserProfile(tenantId, user.uid, fields);
      setSavedAt(new Date());
    } catch (err) {
      console.error(err);
      setError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Avatar + upload */}
      <div className="card flex flex-col items-center gap-4 py-8">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center border-2 border-border">
            {photoURL ? (
              <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={40} className="text-primary/50" />
            )}
          </div>

          {/* Camera overlay */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress !== null}
            className="absolute bottom-0 right-0 w-11 h-11 rounded-full bg-primary flex items-center justify-center shadow-md hover:bg-primary-dark transition-colors disabled:opacity-50"
            aria-label="Upload profile photo"
          >
            <Camera size={14} className="text-white" />
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Upload progress */}
        {uploadProgress !== null && (
          <div className="w-full max-w-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-muted">Uploading…</span>
              <span className="text-xs font-semibold text-primary">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-border rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="text-center">
          <p className="text-sm font-semibold text-ink">{displayName || email}</p>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary mt-1">
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20">
          <AlertCircle size={16} className="text-danger mt-0.5 shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Editable fields */}
      <div className="card flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Edit Profile</p>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="profile-name">Display Name</label>
          <input
            id="profile-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-11 px-3 rounded-lg border border-border bg-surface text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Your name"
          />
        </div>

        {role === 'unit_manager' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-muted" htmlFor="profile-unit-name">
              Unit Name <span className="text-[10px] text-ink-faint">(optional — e.g. "Phoenix Unit")</span>
            </label>
            <input
              id="profile-unit-name"
              type="text"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value.slice(0, 50))}
              maxLength={50}
              className="h-11 px-3 rounded-lg border border-border bg-surface text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. Phoenix Unit"
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="profile-phone">Phone</label>
          <input
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11 px-3 rounded-lg border border-border bg-surface text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="+1 868 000 0000"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="profile-bio">
            Bio
            <span className="ml-2 text-[10px] text-ink-muted/60">{bio.length}/{BIO_MAX}</span>
          </label>
          <textarea
            id="profile-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            rows={3}
            className="px-3 py-2 rounded-lg border border-border bg-surface text-ink text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="A short bio…"
          />
        </div>

        <SaveButton
          onClick={handleSave}
          saving={saving}
          savedAt={savedAt}
          label="Save Changes"
          icon={<Save size={16} />}
        />
      </div>

      {/* E6 — Logging mode (agents only) */}
      {role === 'agent' && (
        <div className="card flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <CalendarClock size={16} className="text-primary" />
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Logging mode</p>
          </div>

          {pendingMode ? (
            <div className="flex flex-col gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <p className="text-sm font-semibold text-ink">Confirm switch</p>
              {pendingMode === 'daily' ? (
                <p className="text-xs text-ink-muted leading-relaxed">
                  Your current weekly draft will be carried over as a single dated catch-up
                  entry for today. Future days will log per-day. The weekly draft will be
                  rebuilt automatically by Sunday's aggregator.
                </p>
              ) : (
                <p className="text-xs text-ink-muted leading-relaxed">
                  Your existing daily entries for this week will be summed into a weekly draft
                  so you can review and submit them on Monday. Daily entries stay as-is and the
                  Sunday aggregator will be a no-op for this week.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelModeSwitch}
                  disabled={modeSaving}
                  className="flex-1 h-10 rounded-lg border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMode}
                  disabled={modeSaving}
                  className="flex-1 h-10 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {modeSaving ? 'Switching…' : 'Confirm switch'}
                </button>
              </div>
            </div>
          ) : (
            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">Choose your logging cadence</legend>

              {[
                {
                  value: 'weekly',
                  title: 'Weekly',
                  desc: 'Submit a single report each week.',
                },
                {
                  value: 'daily',
                  title: 'Daily',
                  desc: "Log activity each day, review and submit weekly. Sunday's aggregator rolls up your entries into the weekly draft automatically.",
                },
                {
                  value: 'hybrid',
                  title: 'Hybrid',
                  desc: 'Pick whichever fits the week — both buttons stay available.',
                },
              ].map((opt) => {
                const descId = `logging-mode-${opt.value}-desc`;
                return (
                  <div
                    key={opt.value}
                    className="flex flex-col p-3 rounded-lg border border-border bg-surface hover:border-primary/40 transition-colors"
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="logging-mode"
                        value={opt.value}
                        checked={loggingMode === opt.value}
                        onChange={() => handleModeSelect(opt.value)}
                        aria-describedby={descId}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="text-sm font-semibold text-ink">{opt.title}</span>
                    </label>
                    <p id={descId} className="text-xs text-ink-muted mt-1 ml-6">
                      {opt.desc}
                    </p>
                  </div>
                );
              })}
            </fieldset>
          )}

          {/* Daily nudge time */}
          {(loggingMode === 'daily' || loggingMode === 'hybrid') && !pendingMode && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-ink-muted" htmlFor="daily-nudge-time">
                Daily reminder time
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="daily-nudge-time"
                  type="time"
                  value={dailyNudgeTime}
                  onChange={(e) => setDailyNudgeTime(e.target.value)}
                  className="h-11 px-3 rounded-lg border border-border bg-surface text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={handleSaveNudgeTime}
                  disabled={modeSaving}
                  className="h-11 px-4 rounded-lg border border-primary text-primary text-sm font-semibold hover:bg-primary/5 transition-colors disabled:opacity-60"
                >
                  {modeSaving ? 'Saving…' : 'Save time'}
                </button>
              </div>
              <p className="text-xs text-ink-muted">
                We'll prompt you at this time on days you haven't logged yet.
                Browser push notifications are coming in a follow-up release —
                for now you'll see a banner on your dashboard.
              </p>
            </div>
          )}

          {modeMessage && (
            <p
              role="status"
              className={`text-xs ${modeMessage.kind === 'error' ? 'text-danger' : 'text-primary'}`}
            >
              {modeMessage.text}
            </p>
          )}
        </div>
      )}

      {/* Read-only info */}
      <div className="card flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Account Info</p>

        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">Email</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink">{email}</span>
            {role === 'tenant_admin' && (
              <button
                type="button"
                onClick={() => setEmailModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors min-h-[44px] px-1"
                aria-label="Update email address"
                data-testid="profile-update-email"
              >
                <Pencil size={12} />
                Update
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">Role</span>
          <span className="text-sm font-medium text-ink">{roleLabel}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">Member Since</span>
          <span className="text-sm font-medium text-ink">{joinDate}</span>
        </div>
      </div>

      {/* Account — sign out (mobile parity with desktop sidebar footer) */}
      <div className="card flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Account</p>
        <button
          type="button"
          onClick={() => { signOut().catch((err) => console.error(err)); }}
          className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg border border-danger/40 text-danger text-sm font-semibold hover:bg-danger/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          data-testid="profile-sign-out"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>

      {emailModalOpen && (
        <EmailUpdateModal onClose={() => setEmailModalOpen(false)} />
      )}
    </div>
  );
}
