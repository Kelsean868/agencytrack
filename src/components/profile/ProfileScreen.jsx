import { useState, useRef } from 'react';
import { Camera, Save, Check, AlertCircle, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../utils/formatters';
import { updateUserProfile, compressImage, uploadProfilePhoto } from '../../services/userService';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const BIO_MAX   = 200;

export default function ProfileScreen() {
  const { user, userProfile, role } = useAuth();

  const [displayName,     setDisplayName]     = useState(userProfile?.name ?? '');
  const [phone,           setPhone]           = useState(userProfile?.phone ?? '');
  const [bio,             setBio]             = useState(userProfile?.bio ?? '');
  const [photoURL,        setPhotoURL]        = useState(userProfile?.photoURL ?? null);
  const [uploadProgress,  setUploadProgress]  = useState(null); // null | 0–100
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);
  const [error,           setError]           = useState(null);

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
      const url = await uploadProfilePhoto(user.uid, compressed, (pct) => {
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

  // ── Profile save ────────────────────────────────────────────────────────
  async function handleSave() {
    if (saving) return;
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      await updateUserProfile(user.uid, {
        name: displayName.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md hover:bg-primary-dark transition-colors disabled:opacity-50"
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
            className="h-11 px-3 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Your name"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="profile-phone">Phone</label>
          <input
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11 px-3 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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
            className="px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="A short bio…"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saved ? (
            <><Check size={16} /> Saved</>
          ) : saving ? (
            'Saving…'
          ) : (
            <><Save size={16} /> Save Changes</>
          )}
        </button>
      </div>

      {/* Read-only info */}
      <div className="card flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Account Info</p>

        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">Email</span>
          <span className="text-sm font-medium text-ink">{email}</span>
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
    </div>
  );
}
